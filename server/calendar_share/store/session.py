"""Encrypted session tokens in ``system_config``."""

from __future__ import annotations

from server.calendar_share.constants import (
    DEFAULT_BASE_URL,
    KEY_ACCESS_TOKEN,
    KEY_BASE_URL,
    KEY_HANDLE,
    KEY_REFRESH_TOKEN,
)
from server.calendar_share.store.normalize import normalize_base_url, normalize_handle
from server.config import get_config, set_configs
from server.db.database import Database


async def get_base_url(db: Database) -> str:
    raw = (await get_config(db, KEY_BASE_URL)).strip()
    return raw.rstrip("/") if raw else DEFAULT_BASE_URL


async def get_handle(db: Database) -> str:
    return (await get_config(db, KEY_HANDLE)).strip()


async def get_access_token(db: Database) -> str:
    return (await get_config(db, KEY_ACCESS_TOKEN)).strip()


async def get_refresh_token(db: Database) -> str:
    return (await get_config(db, KEY_REFRESH_TOKEN)).strip()


async def session_connected(db: Database) -> bool:
    return bool(await get_access_token(db) or await get_refresh_token(db))


async def save_session(
    db: Database,
    *,
    base_url: str,
    handle: str,
    access_token: str,
    refresh_token: str,
) -> None:
    await set_configs(
        db,
        {
            KEY_BASE_URL: normalize_base_url(base_url),
            KEY_HANDLE: normalize_handle(handle),
            KEY_ACCESS_TOKEN: access_token.strip(),
            KEY_REFRESH_TOKEN: refresh_token.strip(),
        },
    )


async def save_tokens(db: Database, *, access_token: str, refresh_token: str | None = None) -> None:
    updates = {KEY_ACCESS_TOKEN: access_token.strip()}
    if refresh_token is not None:
        updates[KEY_REFRESH_TOKEN] = refresh_token.strip()
    await set_configs(db, updates)


async def clear_tokens(db: Database) -> None:
    await set_configs(db, {KEY_ACCESS_TOKEN: "", KEY_REFRESH_TOKEN: ""})


async def clear_session(db: Database) -> None:
    await set_configs(
        db,
        {
            KEY_ACCESS_TOKEN: "",
            KEY_REFRESH_TOKEN: "",
        },
    )
