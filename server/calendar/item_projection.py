"""Project trackable items into calendar wire rows (source=item).

Active items with ``expires_at`` and ``remind_before_days > 0`` emit a
**remind** occurrence on ``expires_at - remind_before_days`` (floating
all-day DATE semantics). ``expires_at`` is a denormalized cache synced from linked
milestone user_events titled 到期 / Expires (見 ``server.items.linked_dates``). Cache is
write-through from linked calendar mutations only; GET list/get does not
reconcile. API no longer accepts item-level date writes.

All-day times use wall-date ``YYYY-MM-DDT00:00:00`` / ``T23:59:59`` (no ``Z``)
so FE ``parseAllDayWallDate`` and user_event all-day DATE semantics stay on the
calendar day (UTC ``…Z`` conversion would shift East-8 by one day).
"""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal, Mapping

from server.db.database import Database
from server.queries.items_queries import fetch_active_items_with_dates, fetch_item_row
from server.worksets_const import SYSTEM_WORKSET_ID

ItemDateKind = Literal["remind"]

ITEM_OCCURRENCE_ID_RE = re.compile(r"^item:([^:]+):(remind)$")


def _date_to_floating_iso(day: date) -> tuple[str, str]:
    """Floating all-day start/end (wall date; align FE ``T00:00:00``)."""
    return f"{day.isoformat()}T00:00:00", f"{day.isoformat()}T23:59:59"


def occurrence_id(item_id: str, kind: ItemDateKind) -> str:
    return f"item:{item_id}:{kind}"


def parse_occurrence_id(event_id: str) -> tuple[str, ItemDateKind] | None:
    match = ITEM_OCCURRENCE_ID_RE.match((event_id or "").strip())
    if match is None:
        return None
    return match.group(1), match.group(2)  # type: ignore[return-value]


def remind_day_for_item(row: Mapping[str, Any]) -> date | None:
    """Return remind calendar day when expires_at + remind_before_days > 0."""
    raw_expires = row.get("expires_at")
    if not isinstance(raw_expires, str) or not raw_expires.strip():
        return None
    remind = row.get("remind_before_days")
    if remind is None:
        return None
    try:
        days = int(remind)
    except (TypeError, ValueError):
        return None
    if days <= 0:
        return None
    try:
        expires = date.fromisoformat(raw_expires.strip()[:10])
    except ValueError:
        return None
    return expires - timedelta(days=days)


def build_item_occurrence(
    row: Mapping[str, Any],
    *,
    kind: ItemDateKind,
    day: date,
    detail: Literal["compact", "full"] = "compact",
    dismissed: bool = False,
) -> dict[str, Any]:
    """Build a calendar row. ``title`` is the bare item title; FE applies i18n prefixes."""
    item_id = str(row["id"])
    title = str(row.get("title") or "")
    start_iso, end_iso = _date_to_floating_iso(day)
    raw_workset = row.get("workset_id")
    workset_id = str(raw_workset).strip() if isinstance(raw_workset, str) and raw_workset.strip() else SYSTEM_WORKSET_ID
    item: dict[str, Any] = {
        "id": occurrence_id(item_id, kind),
        "taskId": "",
        "title": title,
        "startTime": start_iso,
        "endTime": end_iso,
        "location": None,
        "source": "item",
        "isAllDay": True,
        "timezone": "floating",
        "worksetId": workset_id,
        "itemId": item_id,
        "itemDateKind": kind,
        "dismissed": bool(dismissed),
        "important": False,
        "origin": None,
    }
    if detail == "full":
        item["body"] = str(row.get("notes") or "")
        item["createdAt"] = row.get("created_at")
        item["updatedAt"] = row.get("updated_at")
        item["expiresAt"] = row.get("expires_at")
        item["status"] = row.get("status")
    return item


def project_item_row(
    row: Mapping[str, Any],
    *,
    range_start: date,
    range_end: date,
) -> list[dict[str, Any]]:
    """Emit remind occurrences that fall in the DATE window.

    ``expires_at`` stays on the item row for list filters;
    they are no longer projected as special calendar kinds (use linked
    user-events / recurring tasks for timeline dates instead).
    """
    if str(row.get("status") or "") != "active":
        return []
    out: list[dict[str, Any]] = []
    remind_day = remind_day_for_item(row)
    if remind_day is not None and range_start <= remind_day <= range_end:
        out.append(build_item_occurrence(row, kind="remind", day=remind_day))
    return out


def _window_dates(range_start: datetime, range_end: datetime) -> tuple[str, str, date, date]:
    start_utc = range_start.astimezone(timezone.utc) if range_start.tzinfo else range_start.replace(tzinfo=timezone.utc)
    end_utc = range_end.astimezone(timezone.utc) if range_end.tzinfo else range_end.replace(tzinfo=timezone.utc)
    # Pad one day so ISO window edges near midnight do not clip DATE rows.
    start_date = (start_utc - timedelta(days=1)).date()
    end_date = (end_utc + timedelta(days=1)).date()
    return start_date.isoformat(), end_date.isoformat(), start_date, end_date


async def fetch_item_occurrences_in_range(
    db: Database,
    *,
    range_start: datetime,
    range_end: datetime,
    workset_id: str | None = None,
) -> list[dict[str, Any]]:
    start_s, end_s, base_start_d, base_end_d = _window_dates(range_start, range_end)
    rows = await fetch_active_items_with_dates(
        db,
        range_start_date=start_s,
        range_end_date=end_s,
        workset_id=workset_id,
    )
    items: list[dict[str, Any]] = []
    for row in rows:
        items.extend(project_item_row(row, range_start=base_start_d, range_end=base_end_d))
    return items


async def get_item_occurrence(db: Database, event_id: str) -> dict[str, Any] | None:
    parsed = parse_occurrence_id(event_id)
    if parsed is None:
        return None
    item_id, kind = parsed
    row = await fetch_item_row(db, item_id)
    if row is None or str(row.get("status") or "") != "active":
        return None
    day = remind_day_for_item(row)
    if day is None:
        return None
    return build_item_occurrence(row, kind=kind, day=day, detail="full")
