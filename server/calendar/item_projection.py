"""Project trackable items into calendar wire rows (source=item).

DATE columns (``purchased_at`` / ``expires_at``) become floating all-day
occurrences. ``remind_before_days`` never creates a second calendar point —
it only drives list / agent expiring windows.
"""

from __future__ import annotations

import re
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Literal, Mapping
from zoneinfo import ZoneInfo

from server.db.database import Database
from server.queries.items_queries import fetch_active_items_with_dates, fetch_item_row
from server.worksets_const import SYSTEM_WORKSET_ID

ItemDateKind = Literal["purchased", "expires"]

ITEM_OCCURRENCE_ID_RE = re.compile(r"^item:([^:]+):(purchased|expires)$")


def _system_tzinfo() -> timezone | ZoneInfo:
    try:
        return datetime.now().astimezone().tzinfo or timezone.utc
    except Exception:
        return timezone.utc


def _date_to_floating_iso(day: date) -> tuple[str, str]:
    """Local-wall all-day start/end as UTC ISO (matches manual floating RRULE)."""
    local_tz = _system_tzinfo()
    start_dt = datetime.combine(day, time(0, 0), tzinfo=local_tz).astimezone(timezone.utc)
    end_dt = datetime.combine(day, time(23, 59, 59), tzinfo=local_tz).astimezone(timezone.utc)
    return start_dt.strftime("%Y-%m-%dT%H:%M:%SZ"), end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def occurrence_id(item_id: str, kind: ItemDateKind) -> str:
    return f"item:{item_id}:{kind}"


def parse_occurrence_id(event_id: str) -> tuple[str, ItemDateKind] | None:
    match = ITEM_OCCURRENCE_ID_RE.match((event_id or "").strip())
    if match is None:
        return None
    return match.group(1), match.group(2)  # type: ignore[return-value]


def build_item_occurrence(
    row: Mapping[str, Any],
    *,
    kind: ItemDateKind,
    day: date,
    detail: Literal["compact", "full"] = "compact",
    dismissed: bool = False,
) -> dict[str, Any]:
    item_id = str(row["id"])
    title = str(row.get("title") or "")
    prefix = "購入" if kind == "purchased" else "到期"
    display_title = f"{prefix} · {title}" if title else prefix
    start_iso, end_iso = _date_to_floating_iso(day)
    raw_workset = row.get("workset_id")
    workset_id = (
        str(raw_workset).strip() if isinstance(raw_workset, str) and raw_workset.strip() else SYSTEM_WORKSET_ID
    )
    item: dict[str, Any] = {
        "id": occurrence_id(item_id, kind),
        "taskId": "",
        "title": display_title,
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
        "origin": None,
    }
    if detail == "full":
        item["body"] = str(row.get("notes") or "")
        item["createdAt"] = row.get("created_at")
        item["updatedAt"] = row.get("updated_at")
        item["purchasedAt"] = row.get("purchased_at")
        item["expiresAt"] = row.get("expires_at")
        item["status"] = row.get("status")
    return item


def project_item_row(
    row: Mapping[str, Any],
    *,
    range_start: date,
    range_end: date,
) -> list[dict[str, Any]]:
    """Emit purchased/expires occurrences that fall in the DATE window."""
    if str(row.get("status") or "") != "active":
        return []
    out: list[dict[str, Any]] = []
    for kind, key in (("purchased", "purchased_at"), ("expires", "expires_at")):
        raw = row.get(key)
        if not isinstance(raw, str) or not raw.strip():
            continue
        try:
            day = date.fromisoformat(raw.strip()[:10])
        except ValueError:
            continue
        if day < range_start or day > range_end:
            continue
        out.append(build_item_occurrence(row, kind=kind, day=day))  # type: ignore[arg-type]
    return out


def _window_dates(range_start: datetime, range_end: datetime) -> tuple[str, str, date, date]:
    start_utc = range_start.astimezone(timezone.utc) if range_start.tzinfo else range_start.replace(tzinfo=timezone.utc)
    end_utc = range_end.astimezone(timezone.utc) if range_end.tzinfo else range_end.replace(tzinfo=timezone.utc)
    # Pad one day on each side so floating local all-day near UTC midnight is not clipped.
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
    start_s, end_s, start_d, end_d = _window_dates(range_start, range_end)
    rows = await fetch_active_items_with_dates(
        db,
        range_start_date=start_s,
        range_end_date=end_s,
        workset_id=workset_id,
    )
    items: list[dict[str, Any]] = []
    for row in rows:
        items.extend(project_item_row(row, range_start=start_d, range_end=end_d))
    return items


async def get_item_occurrence(db: Database, event_id: str) -> dict[str, Any] | None:
    parsed = parse_occurrence_id(event_id)
    if parsed is None:
        return None
    item_id, kind = parsed
    row = await fetch_item_row(db, item_id)
    if row is None or str(row.get("status") or "") != "active":
        return None
    raw = row.get("purchased_at" if kind == "purchased" else "expires_at")
    if not isinstance(raw, str) or not raw.strip():
        return None
    try:
        day = date.fromisoformat(raw.strip()[:10])
    except ValueError:
        return None
    return build_item_occurrence(row, kind=kind, day=day, detail="full")
