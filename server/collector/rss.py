"""RSS/Atom feed platform adapter (aiohttp + feedparser polling)."""

from __future__ import annotations

import asyncio
import calendar
import logging
from datetime import datetime, timezone
from urllib.parse import urljoin

import aiohttp
import feedparser

from server.collector.base import BasePlatformAdapter
from server.collector.poll_config import DEFAULT_POLL_INTERVAL, clamp_poll_interval
from server.db.database import Database
from server.outbound import OutboundUrlError, validate_outbound_url
from server.sse import SseBroadcaster
from server.time_iso import to_iso_z
from server.util import utc_now_iso

logger = logging.getLogger(__name__)

_RSS_HTTP_TIMEOUT = aiohttp.ClientTimeout(total=30, connect=12, sock_read=20)
_MAX_FEED_REDIRECTS = 3
_SEEN_ENTRIES_MAX = 5000
_MAX_POLL_FAILURES = 3


class RssAdapter(BasePlatformAdapter):
    """Polls RSS feeds and inserts new entries as messages.

    Transient HTTP/parse errors are logged and retried. After
    ``_MAX_POLL_FAILURES`` consecutive failures the account escalates to
    ``error`` + SSE; a successful poll clears the counter and recovers.
    """

    def __init__(
        self,
        account_id: str,
        db: Database,
        broadcaster: SseBroadcaster,
        feed_url: str,
        poll_interval: float = DEFAULT_POLL_INTERVAL,
    ) -> None:
        super().__init__(account_id, db, broadcaster)
        self._feed_url = feed_url
        self._poll_interval = clamp_poll_interval(poll_interval)
        self._seen_entries: set[str] = set()
        self._poll_task: asyncio.Task | None = None
        self._subscribed_platform_ids: list[str] = []
        self._feed_title: str | None = None
        self._session: aiohttp.ClientSession | None = None
        self._poll_failures = 0

    def _platform_name(self) -> str:
        return "rss"

    def _http_headers(self) -> dict[str, str]:
        return {}

    @property
    def feed_title(self) -> str | None:
        return self._feed_title

    async def connect(self) -> None:
        """Validate the feed by fetching + parsing, then start the poll loop."""
        self._state.status = "connecting"
        self._session = aiohttp.ClientSession(timeout=_RSS_HTTP_TIMEOUT)

        try:
            text = await self._fetch_feed_text()

            feed = feedparser.parse(text)
            if feed.bozo and not feed.entries:
                bozo_exc = getattr(feed, "bozo_exception", "unknown parse error")
                raise ValueError(f"Invalid RSS feed at {self._feed_url}: {bozo_exc}")
            if not feed.entries and not getattr(feed.feed, "title", None):
                raise ValueError(f"Invalid RSS feed at {self._feed_url}: no entries or feed title found")

            self._feed_title = getattr(feed.feed, "title", None)

            for entry in feed.entries:
                entry_id = self._get_entry_id(entry)
                if entry_id:
                    self._remember_entry(entry_id)

            await self._load_subscribed_channels()
            self._poll_task = asyncio.create_task(self._poll_loop())

            self._mark_connected()
            self._broadcast_status_change("connected")
            logger.info(
                "RSS adapter connected for account %s (feed: %s, title: %s)",
                self._account_id,
                self._feed_url,
                self._feed_title,
            )
        except Exception:  # noqa: BLE001 — re-raised after cleanup
            if self._session:
                await self._session.close()
                self._session = None
            self._state.status = "disconnected"
            raise

    async def disconnect(self) -> None:
        if self._poll_task is not None and not self._poll_task.done():
            self._poll_task.cancel()
            try:
                await self._poll_task
            except asyncio.CancelledError:
                pass
            self._poll_task = None

        if self._session is not None:
            await self._session.close()
            self._session = None

        self._state.status = "disconnected"
        logger.info("RSS adapter disconnected for account %s", self._account_id)

    async def is_connected(self) -> bool:
        return self._poll_task is not None and not self._poll_task.done()

    async def _record_poll_failure(self, kind: str, exc: BaseException) -> None:
        self._poll_failures += 1
        message = f"RSS poll {kind} error: {exc}"
        logger.warning(
            "RSS poll %s error for account %s (%s) attempt %d/%d: %s",
            kind,
            self._account_id,
            self._feed_url,
            self._poll_failures,
            _MAX_POLL_FAILURES,
            exc,
        )
        if self._poll_failures >= _MAX_POLL_FAILURES:
            self._state.status = "error"
            self._state.last_error = message
            await self._update_account_status("error", message)
            self._broadcast_status_change("error", message)

    async def _record_poll_success(self) -> None:
        self._poll_failures = 0
        if self._state.status == "error":
            self._state.status = "connected"
            self._state.last_error = None
            await self._update_account_status("connected")
            self._broadcast_status_change("connected")

    async def _poll_loop(self) -> None:
        while True:
            await asyncio.sleep(self._poll_interval)

            try:
                assert self._session is not None, "HTTP session not initialized"
                text = await self._fetch_feed_text()
            except aiohttp.ClientError as exc:
                await self._record_poll_failure("HTTP", exc)
                continue
            except asyncio.CancelledError:
                raise
            except (OSError, asyncio.TimeoutError, OutboundUrlError, ValueError) as exc:
                await self._record_poll_failure("fetch", exc)
                continue

            try:
                feed = feedparser.parse(text)
                if feed.bozo and not feed.entries:
                    bozo_exc = getattr(feed, "bozo_exception", "unknown parse error")
                    raise ValueError(f"Invalid RSS feed: {bozo_exc}")
            except ValueError as exc:
                await self._record_poll_failure("parse", exc)
                continue

            await self._record_poll_success()

            for entry in feed.entries:
                entry_id = self._get_entry_id(entry)
                if not entry_id or entry_id in self._seen_entries:
                    continue
                try:
                    title = getattr(entry, "title", "Untitled")
                    content = self._get_entry_content(entry)
                    message_content = f"{title}\n\n{content}" if content else title

                    platform_id = self._subscribed_platform_ids[0] if self._subscribed_platform_ids else self._feed_url

                    await self._insert_message(
                        platform=self._platform_name(),
                        platform_id=platform_id,
                        content=message_content,
                        message_time=self._get_entry_time(entry),
                        sender_name=self._feed_title or "RSS",
                        platform_message_id=entry_id,
                        channel_name=self._feed_title or "",
                    )
                    self._remember_entry(entry_id)
                except (OSError, ValueError) as exc:
                    logger.warning(
                        "RSS poll: failed to insert entry %s for account %s: %s",
                        entry_id,
                        self._account_id,
                        exc,
                    )

    def _remember_entry(self, entry_id: str) -> None:
        self._seen_entries.add(entry_id)
        if len(self._seen_entries) > _SEEN_ENTRIES_MAX:
            excess = len(self._seen_entries) - _SEEN_ENTRIES_MAX
            for _ in range(excess):
                self._seen_entries.pop()

    # ── internal helpers ────────────────────────────────────────────────

    async def _fetch_feed_text(self) -> str:
        assert self._session is not None, "HTTP session not initialized"
        current_url = self._feed_url
        for redirect_count in range(_MAX_FEED_REDIRECTS + 1):
            await validate_outbound_url(current_url)
            async with self._session.get(
                current_url,
                allow_redirects=False,
                headers=self._http_headers(),
            ) as response:
                status = int(getattr(response, "status", 200))
                if status in (301, 302, 303, 307, 308):
                    location = getattr(response, "headers", {}).get("location")
                    if not location:
                        raise ValueError("RSS redirect is missing a Location header")
                    if redirect_count >= _MAX_FEED_REDIRECTS:
                        raise ValueError("RSS feed exceeded the redirect limit")
                    current_url = urljoin(current_url, location)
                    continue
                response.raise_for_status()
                return await response.text()
        raise ValueError("RSS feed exceeded the redirect limit")

    @staticmethod
    def _get_entry_id(entry) -> str | None:
        entry_id = getattr(entry, "id", None)
        if entry_id:
            return entry_id
        return getattr(entry, "link", None)

    @staticmethod
    def _get_entry_content(entry) -> str:
        content = getattr(entry, "summary", None)
        if content:
            return content
        return getattr(entry, "description", "")

    @staticmethod
    def _get_entry_time(entry) -> str:
        published_parsed = getattr(entry, "published_parsed", None)
        if published_parsed:
            try:
                timestamp = calendar.timegm(published_parsed)
                return to_iso_z(datetime.fromtimestamp(timestamp, tz=timezone.utc))
            except (ValueError, OverflowError, OSError):
                pass
        return utc_now_iso()

    async def _load_subscribed_channels(self) -> None:
        platform = self._platform_name()
        rows = await self._db.fetch_all(
            "SELECT platform_id FROM account_channels WHERE account_id = ? AND platform = ?",
            (self._account_id, platform),
        )
        self._subscribed_platform_ids = [row["platform_id"] for row in rows]
        if not self._subscribed_platform_ids:
            self._subscribed_platform_ids = [self._feed_url]
