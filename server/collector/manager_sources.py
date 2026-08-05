"""Platform-specific CollectorManager source source flows.

Discord / RSS / MQTT / Email create+update helpers share ManagerPlatformHost
(internals of CollectorManager). Telegram interactive login stays in
``telegram_login.py``.
"""

from __future__ import annotations

from typing import Awaitable, Callable, Protocol, cast

from server.collector.base import BasePlatformAdapter
from server.collector.capabilities import as_discord
from server.collector.email_imap import EmailImapAdapter
from server.collector.http_poll import HttpPollAdapter, normalize_http_credentials
from server.collector.rss import RssAdapter


class ManagerPlatformHost(Protocol):
    """Shared internals exposed to platform source helpers."""

    @property
    def _adapters(self) -> dict[str, BasePlatformAdapter]: ...

    async def _build_and_connect(
        self,
        source_id: str,
        platform: str,
        creds: dict,
    ) -> BasePlatformAdapter: ...

    async def _replace_adapter(
        self,
        source_id: str,
        build_fn: Callable[[], Awaitable[dict]],
    ) -> dict: ...


# ── Discord ─────────────────────────────────────────────────────────────


async def create_discord_bot(host: ManagerPlatformHost, source_id: str, bot_token: str) -> dict:
    adapter = as_discord(
        await host._build_and_connect(source_id, "discord", {"bot_token": bot_token}),
    )
    channels = await adapter.list_channels()
    return {"status": "connected", "channels": channels}


async def update_discord_bot(host: ManagerPlatformHost, source_id: str, credentials: dict) -> dict:
    bot_token = str(credentials.get("bot_token") or "")
    return await host._replace_adapter(
        source_id,
        lambda: create_discord_bot(host, source_id, bot_token),
    )


async def subscribe_discord_channels(
    host: ManagerPlatformHost,
    source_id: str,
    channel_ids: list[str],
) -> None:
    adapter = host._adapters.get(source_id)
    if adapter is None:
        raise KeyError(f"No active adapter for source {source_id}")
    await as_discord(adapter).set_subscriptions(channel_ids)


# ── RSS ─────────────────────────────────────────────────────────────────


async def create_rss_feed(
    host: ManagerPlatformHost,
    source_id: str,
    feed_url: str,
    poll_interval_seconds: int = 300,
) -> dict:
    adapter = cast(
        RssAdapter,
        await host._build_and_connect(
            source_id,
            "rss",
            {"feed_url": feed_url, "poll_interval_seconds": poll_interval_seconds},
        ),
    )
    return {
        "status": "connected",
        "feed_title": adapter.feed_title,
        "channel": source_id,
    }


async def update_rss_feed(host: ManagerPlatformHost, source_id: str, credentials: dict) -> dict:
    feed_url = str(credentials.get("feed_url") or "")
    poll_interval = int(credentials.get("poll_interval_seconds") or 300)
    return await host._replace_adapter(
        source_id,
        lambda: create_rss_feed(host, source_id, feed_url, poll_interval_seconds=poll_interval),
    )


# ── HTTP poll ───────────────────────────────────────────────────────────


async def create_http_source(host: ManagerPlatformHost, source_id: str, credentials: dict) -> dict:
    normalized = normalize_http_credentials(credentials)
    adapter = cast(
        HttpPollAdapter,
        await host._build_and_connect(source_id, "http", normalized),
    )
    return {
        "status": "connected",
        "url": adapter.url,
        "channel": source_id,
    }


async def update_http_source(host: ManagerPlatformHost, source_id: str, credentials: dict) -> dict:
    return await host._replace_adapter(
        source_id,
        lambda: create_http_source(host, source_id, credentials),
    )


# ── MQTT ────────────────────────────────────────────────────────────────


async def create_mqtt_broker(
    host: ManagerPlatformHost,
    source_id: str,
    broker_url: str,
    topics: list[str],
    username: str | None = None,
    password: str | None = None,
    client_id: str | None = None,
) -> dict:
    await host._build_and_connect(
        source_id,
        "mqtt",
        {
            "broker_url": broker_url,
            "topics": topics,
            "username": username,
            "password": password,
            "client_id": client_id,
        },
    )
    return {"status": "connected"}


async def update_mqtt_broker(host: ManagerPlatformHost, source_id: str, credentials: dict) -> dict:
    topics = credentials.get("topics")
    topic_list = topics if isinstance(topics, list) else []

    async def _recreate() -> dict:
        return await create_mqtt_broker(
            host,
            source_id,
            str(credentials.get("broker_url") or ""),
            topic_list,
            username=credentials.get("username"),
            password=credentials.get("password"),
            client_id=credentials.get("client_id"),
        )

    return await host._replace_adapter(source_id, _recreate)


# ── Email ───────────────────────────────────────────────────────────────


async def create_email_mailbox(
    host: ManagerPlatformHost,
    source_id: str,
    credentials: dict,
) -> dict:
    adapter = cast(
        EmailImapAdapter,
        await host._build_and_connect(source_id, "email", credentials),
    )
    return {"status": "connected", "folders": adapter.folders}


async def update_email_mailbox(
    host: ManagerPlatformHost,
    source_id: str,
    credentials: dict,
) -> dict:
    return await host._replace_adapter(
        source_id,
        lambda: create_email_mailbox(host, source_id, credentials),
    )
