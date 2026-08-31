"""Unified auto-sync interval constants shared by store, API, and the loop."""

from __future__ import annotations

from server.calendar_share.constants import KEY_AUTO_SYNC, KEY_AUTO_SYNC_INTERVAL
from server.config import get_config, set_configs
from server.db.database import Database

#: IntelligenceCalendar compiled default ``minWriteIntervalSeconds`` (10). Do not lower.
IC_MIN_WRITE_INTERVAL_SECONDS = 10.0
#: Space IC writes across worksets. Keep >= IC min write interval.
WRITE_SPACING_SECONDS = IC_MIN_WRITE_INTERVAL_SECONDS
#: Minimum user-chosen auto-sync interval (also legacy global scan default).
AUTO_SYNC_INTERVAL_FLOOR_SECONDS = max(60, int(IC_MIN_WRITE_INTERVAL_SECONDS))
DEFAULT_AUTO_SYNC_INTERVAL_SECONDS = AUTO_SYNC_INTERVAL_FLOOR_SECONDS
#: Loop tick while waiting for per-row intervals to elapse.
LOOP_TICK_SECONDS = WRITE_SPACING_SECONDS


def normalize_auto_sync_interval_seconds(raw: object) -> int:
    """Coerce and clamp a user interval to the IC-aware floor."""
    try:
        value = int(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        value = DEFAULT_AUTO_SYNC_INTERVAL_SECONDS
    return max(AUTO_SYNC_INTERVAL_FLOOR_SECONDS, value)


def _parse_auto_sync_flag(raw: str) -> bool:
    text = raw.strip().lower()
    return text not in {"0", "false", "off", "no"}


async def read_unified_auto_sync(db: Database) -> tuple[bool, int]:
    """Household-wide auto-update (system_config). Defaults on / 60s."""
    raw_on = (await get_config(db, KEY_AUTO_SYNC)).strip()
    auto_sync = True if raw_on == "" else _parse_auto_sync_flag(raw_on)
    raw_interval = (await get_config(db, KEY_AUTO_SYNC_INTERVAL)).strip()
    interval = normalize_auto_sync_interval_seconds(raw_interval or DEFAULT_AUTO_SYNC_INTERVAL_SECONDS)
    return auto_sync, interval


async def apply_unified_auto_sync(
    db: Database,
    *,
    auto_sync: bool | None = None,
    interval_seconds: int | None = None,
) -> tuple[bool, int]:
    """Persist unified settings and mirror them onto every publish row."""
    current_on, current_interval = await read_unified_auto_sync(db)
    next_on = current_on if auto_sync is None else bool(auto_sync)
    next_interval = (
        current_interval if interval_seconds is None else normalize_auto_sync_interval_seconds(interval_seconds)
    )
    await set_configs(
        db,
        {
            KEY_AUTO_SYNC: "true" if next_on else "false",
            KEY_AUTO_SYNC_INTERVAL: str(next_interval),
        },
    )
    if next_on:
        await db.execute(
            "UPDATE calendar_share_publish SET auto_sync = 1, auto_sync_interval_seconds = ?",
            (next_interval,),
        )
    else:
        await db.execute(
            """
            UPDATE calendar_share_publish
            SET auto_sync = 0, pending_sync = 0, auto_sync_interval_seconds = ?
            """,
            (next_interval,),
        )
    return next_on, next_interval
