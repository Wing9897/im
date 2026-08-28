"""Pinned household timezone config in ``system_config``."""

from __future__ import annotations

from typing import Any

from server.calendar_share.constants import KEY_TIMEZONE, KEY_TIMEZONE_LAST_PUBLIC, KEY_TIMEZONE_PENDING
from server.config import get_config, set_configs
from server.db.database import Database
from server.util import parse_bool


async def get_calendar_timezone(db: Database) -> str:
    return (await get_config(db, KEY_TIMEZONE)).strip()


async def get_timezone_state(db: Database) -> dict[str, Any]:
    from server.calendar_share.timezone import system_iana_timezone

    timezone = await get_calendar_timezone(db)
    last_public = (await get_config(db, KEY_TIMEZONE_LAST_PUBLIC)).strip()
    pending = parse_bool(await get_config(db, KEY_TIMEZONE_PENDING))
    return {
        "timezone": timezone,
        "lastPublicTimezone": last_public,
        "pendingPublicTimezone": pending,
        "suggestedTimezone": system_iana_timezone(),
    }


async def save_calendar_timezone(db: Database, timezone: str) -> None:
    await set_configs(db, {KEY_TIMEZONE: timezone})


async def mark_public_timezone_result(db: Database, timezone: str, *, ok: bool) -> None:
    last_public = (await get_config(db, KEY_TIMEZONE_LAST_PUBLIC)).strip()
    if ok:
        await set_configs(
            db,
            {
                KEY_TIMEZONE_PENDING: "false",
                KEY_TIMEZONE_LAST_PUBLIC: timezone,
            },
        )
        return
    if timezone and timezone == last_public:
        await set_configs(db, {KEY_TIMEZONE_PENDING: "false"})
        return
    await set_configs(db, {KEY_TIMEZONE_PENDING: "true"})


async def sync_pending_public_timezone(db: Database) -> dict[str, Any]:
    """If a prior public replica write is pending, retry after login or explicit save."""
    from server.calendar_share.timezone import push_public_timezone

    state = await get_timezone_state(db)
    timezone = str(state["timezone"] or "")
    if not timezone or not state["pendingPublicTimezone"]:
        return state
    ok = await push_public_timezone(db, timezone)
    await mark_public_timezone_result(db, timezone, ok=ok)
    return await get_timezone_state(db)
