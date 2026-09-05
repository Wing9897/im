"""Wire-facing publish readers/writers that overlay the household auto-sync.

``system_config`` (``read_unified_auto_sync``) is the only source of truth for
``autoSync`` / ``autoSyncIntervalSeconds``; rows never store them. Every entry
leaving this module carries the household values, and the dirty-flag writers
are gated on the household switch.
"""

from __future__ import annotations

from typing import Any

from server.calendar_share.auto_sync_config import read_unified_auto_sync
from server.calendar_share.store.publish_io import (
    _clean_workset_entry,
    empty_workset_entry,
    fetch_publish_row,
    fetch_publish_rows,
    fetch_publish_rows_joined,
    mark_live_replicas_pending,
    sql_row_to_entry,
    write_workset_entry,
)
from server.db.database import Database
from server.errors import VALIDATION_ERROR, http_error
from server.wire.serializers import serialize_catalog_wire_fields
from server.worksets_const import SYSTEM_WORKSET_ID


def _with_household_auto_sync(
    entry: dict[str, Any],
    *,
    auto_sync: bool,
    interval_seconds: int,
) -> dict[str, Any]:
    return {**entry, "autoSync": auto_sync, "autoSyncIntervalSeconds": interval_seconds}


def _joined_catalog_fields(row: dict[str, Any], *, missing: bool) -> dict[str, str]:
    if missing:
        return serialize_catalog_wire_fields({})
    return serialize_catalog_wire_fields(
        {
            "description": row.get("workset_description"),
            "cover": row.get("workset_cover"),
        }
    )


async def load_workset_map(db: Database) -> dict[str, dict[str, Any]]:
    household_on, household_interval = await read_unified_auto_sync(db)
    out: dict[str, dict[str, Any]] = {}
    for row in await fetch_publish_rows(db):
        entry = sql_row_to_entry(row)
        if entry is not None:
            out[str(entry["worksetId"])] = _with_household_auto_sync(
                entry, auto_sync=household_on, interval_seconds=household_interval
            )
    return out


async def list_publish_joined(db: Database) -> list[dict[str, Any]]:
    """Publish rows LEFT JOIN worksets (unpublished worksets have no row)."""
    household_on, household_interval = await read_unified_auto_sync(db)
    items: list[dict[str, Any]] = []
    for data in await fetch_publish_rows_joined(db):
        entry = sql_row_to_entry(data)
        if entry is None:
            continue
        missing = data.get("workset_name") is None
        items.append(
            {
                **_with_household_auto_sync(entry, auto_sync=household_on, interval_seconds=household_interval),
                "worksetName": str(data.get("workset_name") or ""),
                "worksetMissing": missing,
                **_joined_catalog_fields(data, missing=missing),
                "isSystemWorkset": bool(data.get("workset_is_system")) or entry["worksetId"] == SYSTEM_WORKSET_ID,
            }
        )
    items.sort(
        key=lambda item: (
            bool(item["worksetMissing"]),
            str(item["worksetName"] or item["worksetId"]).casefold(),
            str(item["worksetId"]),
        )
    )
    return items


async def get_workset_entry(db: Database, workset_id: str) -> dict[str, Any]:
    household_on, household_interval = await read_unified_auto_sync(db)
    row = await fetch_publish_row(db, workset_id)
    entry = sql_row_to_entry(row) if row is not None else None
    return _with_household_auto_sync(
        entry or empty_workset_entry(workset_id),
        auto_sync=household_on,
        interval_seconds=household_interval,
    )


async def upsert_workset_entry(db: Database, workset_id: str, entry: dict[str, Any]) -> dict[str, Any]:
    cleaned = _clean_workset_entry(workset_id, {**empty_workset_entry(workset_id), **entry, "worksetId": workset_id})
    if cleaned is None:
        raise http_error(422, "Invalid workset publish mapping", error_code=VALIDATION_ERROR)
    await write_workset_entry(db, workset_id, cleaned)
    household_on, household_interval = await read_unified_auto_sync(db)
    return _with_household_auto_sync(cleaned, auto_sync=household_on, interval_seconds=household_interval)


async def mark_workset_pending(db: Database, *workset_ids: str) -> None:
    wanted = [str(wid).strip() for wid in workset_ids if str(wid or "").strip()]
    if not wanted:
        return
    household_on, _ = await read_unified_auto_sync(db)
    if not household_on:
        return
    await mark_live_replicas_pending(db, wanted)


async def mark_all_live_replicas_pending(db: Database) -> None:
    household_on, _ = await read_unified_auto_sync(db)
    if not household_on:
        return
    await mark_live_replicas_pending(db)
