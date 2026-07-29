"""HTTP poll platform adapter (aiohttp GET/POST polling)."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any
from urllib.parse import urljoin

import aiohttp

from server.collector.base import BasePlatformAdapter
from server.collector.http_poll_helpers import (
    DEFAULT_MAX_CONTENT_CHARS,
    DEFAULT_TIMEOUT_SECONDS,
    MAX_HEADERS,
    HttpPollContentError,
    build_request_headers,
    clamp_max_content_chars,
    clamp_timeout_seconds,
    encode_request_body,
    normalize_http_credentials,
    prepare_message_content,
    response_content_hash,
)
from server.db.database import Database
from server.outbound import OutboundUrlError, validate_outbound_url
from server.sse import SseBroadcaster
from server.util import utc_now_iso

logger = logging.getLogger(__name__)

_MAX_REDIRECTS = 3
_SEEN_HASHES_MAX = 5000

# Re-export helpers so existing `from server.collector.http_poll import …` stays stable.
__all__ = [
    "DEFAULT_MAX_CONTENT_CHARS",
    "DEFAULT_TIMEOUT_SECONDS",
    "MAX_HEADERS",
    "HttpPollAdapter",
    "HttpPollContentError",
    "build_request_headers",
    "clamp_max_content_chars",
    "clamp_timeout_seconds",
    "encode_request_body",
    "normalize_http_credentials",
    "prepare_message_content",
    "response_content_hash",
]


class HttpPollAdapter(BasePlatformAdapter):
    """Polls an HTTP endpoint and inserts each successful response as one message.

    Transient HTTP errors are logged and retried on the next cycle. Oversized
    JSON responses fail that poll round (account error + log) without insert.
    """

    def __init__(
        self,
        account_id: str,
        db: Database,
        broadcaster: SseBroadcaster,
        credentials: dict[str, Any],
    ) -> None:
        super().__init__(account_id, db, broadcaster)
        self._creds = normalize_http_credentials(credentials)
        self._poll_interval = float(self._creds["poll_interval_seconds"])
        self._seen_hashes: set[str] = set()
        self._poll_task: asyncio.Task | None = None
        self._subscribed_platform_ids: list[str] = []
        self._session: aiohttp.ClientSession | None = None

    def _platform_name(self) -> str:
        return "http"

    @property
    def url(self) -> str:
        return str(self._creds["url"])

    async def connect(self) -> None:
        self._state.status = "connecting"
        timeout = aiohttp.ClientTimeout(
            total=self._creds["timeout_seconds"],
            connect=min(12, self._creds["timeout_seconds"]),
            sock_read=min(20, self._creds["timeout_seconds"]),
        )
        self._session = aiohttp.ClientSession(timeout=timeout)

        try:
            await self._load_subscribed_channels()
            await self._poll_once()
            self._poll_task = asyncio.create_task(self._poll_loop())
            self._mark_connected()
            self._broadcast_status_change("connected")
            logger.info(
                "HTTP poll adapter connected for account %s (%s %s)",
                self._account_id,
                self._creds["method"],
                self._creds["url"],
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
        logger.info("HTTP poll adapter disconnected for account %s", self._account_id)

    async def is_connected(self) -> bool:
        return self._poll_task is not None and not self._poll_task.done()

    async def _poll_loop(self) -> None:
        while True:
            await asyncio.sleep(self._poll_interval)
            try:
                await self._poll_once()
                if self._state.status == "error":
                    self._mark_connected()
                    await self._update_account_status("connected")
                    self._broadcast_status_change("connected")
            except asyncio.CancelledError:
                raise
            except HttpPollContentError as exc:
                await self._mark_content_error(exc)
            except aiohttp.ClientError as exc:
                logger.warning(
                    "HTTP poll HTTP error for account %s (%s): %s",
                    self._account_id,
                    self._creds["url"],
                    exc,
                )
            except (OSError, asyncio.TimeoutError, OutboundUrlError, ValueError, json.JSONDecodeError) as exc:
                logger.warning("HTTP poll fetch error for account %s: %s", self._account_id, exc)

    async def _poll_once(self) -> None:
        assert self._session is not None, "HTTP session not initialized"
        body_bytes, content_type, body_text = await self._fetch_response()
        content = prepare_message_content(
            body_text,
            content_type=content_type,
            max_chars=int(self._creds["max_content_chars"]),
        )
        await self._ingest_response(body_bytes, content)

    async def _mark_content_error(self, exc: HttpPollContentError) -> None:
        logger.warning(
            "HTTP poll content error for account %s (%s): %s",
            self._account_id,
            self._creds["url"],
            exc,
        )
        self._state.status = "error"
        self._state.last_error = str(exc)
        await self._update_account_status("error", last_error=str(exc))
        self._broadcast_status_change("error", last_error=str(exc))

    async def _ingest_response(self, body_bytes: bytes, content: str) -> None:
        message_id = response_content_hash(
            str(self._creds["method"]),
            str(self._creds["url"]),
            body_bytes,
        )
        if message_id in self._seen_hashes:
            return

        platform_id = self._subscribed_platform_ids[0] if self._subscribed_platform_ids else str(self._creds["url"])
        await self._insert_message(
            platform=self._platform_name(),
            platform_id=platform_id,
            content=content,
            message_time=utc_now_iso(),
            sender_name="HTTP",
            platform_message_id=message_id,
            channel_name=str(self._creds["url"]),
        )
        self._remember_hash(message_id)

    def _remember_hash(self, content_hash: str) -> None:
        self._seen_hashes.add(content_hash)
        if len(self._seen_hashes) > _SEEN_HASHES_MAX:
            excess = len(self._seen_hashes) - _SEEN_HASHES_MAX
            for _ in range(excess):
                self._seen_hashes.pop()

    async def _fetch_response(self) -> tuple[bytes, str | None, str]:
        assert self._session is not None, "HTTP session not initialized"
        method = str(self._creds["method"]).upper()
        headers = build_request_headers(self._creds)
        body = encode_request_body(self._creds)
        current_url = str(self._creds["url"])

        for redirect_count in range(_MAX_REDIRECTS + 1):
            await validate_outbound_url(current_url)
            kwargs: dict[str, Any] = {
                "allow_redirects": False,
                "headers": headers,
            }
            if body is not None and method == "POST":
                kwargs["data"] = body

            async with self._session.request(method, current_url, **kwargs) as response:
                status = int(getattr(response, "status", 200))
                if status in (301, 302, 303, 307, 308):
                    location = getattr(response, "headers", {}).get("location")
                    if not location:
                        raise ValueError("HTTP redirect is missing a Location header")
                    if redirect_count >= _MAX_REDIRECTS:
                        raise ValueError("HTTP request exceeded the redirect limit")
                    current_url = urljoin(current_url, location)
                    continue
                response.raise_for_status()
                body_bytes = await response.read()
                content_type = getattr(response, "headers", {}).get("Content-Type")
                try:
                    body_text = body_bytes.decode("utf-8")
                except UnicodeDecodeError:
                    body_text = body_bytes.decode("utf-8", errors="replace")
                return body_bytes, content_type, body_text

        raise ValueError("HTTP request exceeded the redirect limit")

    async def _load_subscribed_channels(self) -> None:
        platform = self._platform_name()
        rows = await self._db.fetch_all(
            "SELECT platform_id FROM account_channels WHERE account_id = ? AND platform = ?",
            (self._account_id, platform),
        )
        self._subscribed_platform_ids = [row["platform_id"] for row in rows]
        if not self._subscribed_platform_ids:
            self._subscribed_platform_ids = [str(self._creds["url"])]
