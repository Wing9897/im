"""Platform adapter factory — thin registry of platform → builder.

Interactive ``create_*`` flows and auto-connect share ``build_adapter``.
Heavy client libraries stay lazy-imported inside each builder.

To add a platform: append ``COLLECTOR_PLATFORMS``, implement the adapter,
register a builder here, then align accounts routes and FE source plugins.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Final

from server.collector.base import BasePlatformAdapter
from server.collector.email_config import (
    build_email_credentials,
    default_imap_port,
)
from server.collector.poll_config import DEFAULT_POLL_INTERVAL, clamp_poll_interval
from server.db.database import Database
from server.domain.collector_platforms import COLLECTOR_PLATFORMS
from server.sse import SseBroadcaster

logger = logging.getLogger(__name__)

AdapterBuilder = Callable[..., BasePlatformAdapter | None]


def _build_telegram(
    account_id: str,
    creds: dict,
    *,
    db: Database,
    broadcaster: SseBroadcaster,
    session_dir: str,
) -> BasePlatformAdapter | None:
    api_id = creds.get("api_id")
    api_hash = creds.get("api_hash")
    if not api_id or not api_hash:
        logger.warning(
            "Telegram account %s missing api_id/api_hash in credentials",
            account_id,
        )
        return None
    from server.collector.telegram import TelegramAdapter

    return TelegramAdapter(account_id, db, broadcaster, int(api_id), api_hash, session_dir)


def _build_discord(
    account_id: str,
    creds: dict,
    *,
    db: Database,
    broadcaster: SseBroadcaster,
    session_dir: str,
) -> BasePlatformAdapter | None:
    del session_dir  # unused for discord
    bot_token = creds.get("bot_token")
    if not bot_token:
        logger.warning("Discord account %s missing bot_token in credentials", account_id)
        return None
    from server.collector.discord import DiscordAdapter

    return DiscordAdapter(account_id, db, broadcaster, bot_token)


def _build_rss(
    account_id: str,
    creds: dict,
    *,
    db: Database,
    broadcaster: SseBroadcaster,
    session_dir: str,
) -> BasePlatformAdapter | None:
    del session_dir
    feed_url = creds.get("feed_url")
    if not feed_url:
        logger.warning("RSS account %s missing feed_url in credentials", account_id)
        return None
    from server.collector.rss import RssAdapter

    poll_raw = creds.get("poll_interval_seconds", DEFAULT_POLL_INTERVAL)
    return RssAdapter(account_id, db, broadcaster, feed_url, clamp_poll_interval(poll_raw))


def _build_http(
    account_id: str,
    creds: dict,
    *,
    db: Database,
    broadcaster: SseBroadcaster,
    session_dir: str,
) -> BasePlatformAdapter | None:
    del session_dir
    url = creds.get("url")
    if not url:
        logger.warning("HTTP account %s missing url in credentials", account_id)
        return None
    from server.collector.http_poll import HttpPollAdapter, normalize_http_credentials

    try:
        normalized = normalize_http_credentials(creds)
    except ValueError as exc:
        logger.warning("HTTP account %s invalid credentials: %s", account_id, exc)
        return None
    return HttpPollAdapter(account_id, db, broadcaster, normalized)


def _build_mqtt(
    account_id: str,
    creds: dict,
    *,
    db: Database,
    broadcaster: SseBroadcaster,
    session_dir: str,
) -> BasePlatformAdapter | None:
    del session_dir
    broker_url = creds.get("broker_url")
    if not broker_url:
        logger.warning("MQTT account %s missing broker_url in credentials", account_id)
        return None
    topics_raw = creds.get("topics") or []
    if isinstance(topics_raw, str):
        topics = [t.strip() for t in topics_raw.split(",") if t.strip()]
    else:
        topics = list(topics_raw)
    from server.collector.mqtt import MqttAdapter

    return MqttAdapter(
        account_id,
        db,
        broadcaster,
        broker_url,
        topics,
        username=creds.get("username"),
        password=creds.get("password"),
        client_id=creds.get("client_id"),
    )


def _build_email(
    account_id: str,
    creds: dict,
    *,
    db: Database,
    broadcaster: SseBroadcaster,
    session_dir: str,
) -> BasePlatformAdapter | None:
    del session_dir
    imap_host = creds.get("imap_host")
    username = creds.get("username")
    password = creds.get("password")
    if not imap_host or not username or not password:
        logger.warning(
            "Email account %s missing imap_host/username/password in credentials",
            account_id,
        )
        return None
    from server.collector.email_imap import EmailImapAdapter

    use_ssl = bool(creds.get("use_ssl", True))
    folder_cursors = creds.get("folder_cursors") or {}
    if not isinstance(folder_cursors, dict):
        folder_cursors = {}
    folder_uidvalidities = creds.get("folder_uidvalidities") or {}
    if not isinstance(folder_uidvalidities, dict):
        folder_uidvalidities = {}
    normalized = build_email_credentials(
        imap_host=str(imap_host),
        imap_port=int(creds.get("imap_port") or default_imap_port(use_ssl=use_ssl)),
        use_ssl=use_ssl,
        username=str(username),
        password=str(password),
        folders=creds.get("folders"),
        poll_interval_seconds=creds.get("poll_interval_seconds"),
        initial_sync_days=creds.get("initial_sync_days"),
        initial_sync_max_messages=creds.get("initial_sync_max_messages"),
        sender_allowlist=creds.get("sender_allowlist"),
        mark_as_read=bool(creds.get("mark_as_read", False)),
        folder_cursors={str(k): int(v) for k, v in folder_cursors.items()},
        folder_uidvalidities={str(k): int(v) for k, v in folder_uidvalidities.items()},
    )
    return EmailImapAdapter(
        account_id,
        db,
        broadcaster,
        imap_host=normalized["imap_host"],
        imap_port=normalized["imap_port"],
        username=normalized["username"],
        password=normalized["password"],
        use_ssl=normalized["use_ssl"],
        folders=normalized["folders"],
        poll_interval_seconds=normalized["poll_interval_seconds"],
        initial_sync_days=normalized["initial_sync_days"],
        initial_sync_max_messages=normalized["initial_sync_max_messages"],
        sender_allowlist=normalized["sender_allowlist"],
        mark_as_read=normalized["mark_as_read"],
        folder_cursors=normalized["folder_cursors"],
        folder_uidvalidities=normalized["folder_uidvalidities"],
    )


#: Official collector platform id → adapter builder (Input-layer registry).
ADAPTER_BUILDERS: Final[dict[str, AdapterBuilder]] = {
    "telegram": _build_telegram,
    "discord": _build_discord,
    "rss": _build_rss,
    "http": _build_http,
    "mqtt": _build_mqtt,
    "email": _build_email,
}

# Insertion order must match ``COLLECTOR_PLATFORMS`` (drift-tested).
REGISTERED_COLLECTOR_PLATFORMS: Final[tuple[str, ...]] = tuple(ADAPTER_BUILDERS)

if REGISTERED_COLLECTOR_PLATFORMS != COLLECTOR_PLATFORMS:
    raise RuntimeError(
        "ADAPTER_BUILDERS keys must match domain.collector_platforms.COLLECTOR_PLATFORMS "
        f"({REGISTERED_COLLECTOR_PLATFORMS!r} != {COLLECTOR_PLATFORMS!r})"
    )


def build_adapter(
    account_id: str,
    platform: str,
    creds: dict,
    *,
    db: Database,
    broadcaster: SseBroadcaster,
    session_dir: str,
) -> BasePlatformAdapter | None:
    """Construct the adapter for an account (not yet connected).

    Returns None when the platform is unsupported or credentials are missing.
    """
    builder = ADAPTER_BUILDERS.get(platform)
    if builder is None:
        return None
    return builder(
        account_id,
        creds,
        db=db,
        broadcaster=broadcaster,
        session_dir=session_dir,
    )
