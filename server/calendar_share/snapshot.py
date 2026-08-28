"""Fingerprint maps and hashes for calendar-share snapshots.

Skip unchanged event uploads via uid fingerprints plus visibility.
PATCH ``baseHash`` is the server ``events_hash`` (response ``contentHash``),
not a second local aggregate. Grants still use ``grants_content_hash``.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from server.util import parse_json_list


def _canonical_event(event: dict[str, Any]) -> dict[str, Any]:
    return {
        "allDay": bool(event.get("allDay")),
        "description": str(event.get("description") or ""),
        "end": str(event.get("end") or ""),
        "location": str(event.get("location") or ""),
        "start": str(event.get("start") or ""),
        "title": str(event.get("title") or ""),
        "uid": str(event.get("uid") or ""),
    }


def _canonical_series(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "description": str(item.get("description") or ""),
        "dtend": str(item.get("dtend") or ""),
        "dtstart": str(item.get("dtstart") or ""),
        "exdatesJson": str(item.get("exdatesJson") or "[]"),
        "isActive": bool(item.get("isActive", True)),
        "isAllDay": bool(item.get("isAllDay")),
        "location": str(item.get("location") or ""),
        "name": str(item.get("name") or ""),
        "rdatesJson": str(item.get("rdatesJson") or "[]"),
        "rrule": str(item.get("rrule") or ""),
        "timezone": str(item.get("timezone") or ""),
        "timezoneIcal": str(item.get("timezoneIcal") or ""),
        "uid": str(item.get("uid") or ""),
    }


def item_fingerprint(canonical: dict[str, Any]) -> str:
    encoded = json.dumps(canonical, ensure_ascii=True, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def events_content_hash(
    events: list[dict[str, Any]],
    series: list[dict[str, Any]] | None = None,
) -> str:
    """IC ``contentHash`` / PATCH ``baseHash`` over canonical event+series rows."""
    event_rows = sorted((_canonical_event(event) for event in events), key=lambda row: row["uid"])
    series_rows = sorted((_canonical_series(item) for item in (series or [])), key=lambda row: row["uid"])
    encoded = json.dumps(
        {"events": event_rows, "series": series_rows},
        ensure_ascii=True,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def fingerprint_maps(
    events: list[dict[str, Any]],
    series: list[dict[str, Any]] | None = None,
) -> dict[str, dict[str, str]]:
    return {
        "events": {
            row["uid"]: item_fingerprint(_canonical_event(row)) for row in events if str(row.get("uid") or "").strip()
        },
        "series": {
            row["uid"]: item_fingerprint(_canonical_series(row))
            for row in (series or [])
            if str(row.get("uid") or "").strip()
        },
    }


def _uid_map(raw: Any) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    return {str(uid): str(digest) for uid, digest in raw.items() if str(uid).strip()}


def snapshot_unchanged(
    prev_fps: dict[str, Any] | None,
    curr_fps: dict[str, Any] | None,
    prev_vis: str,
    vis: str,
) -> bool:
    """True when uid fingerprint maps and public visibility both match."""
    prev = prev_fps if isinstance(prev_fps, dict) else {}
    curr = curr_fps if isinstance(curr_fps, dict) else {}
    return (
        _uid_map(prev.get("events")) == _uid_map(curr.get("events"))
        and _uid_map(prev.get("series")) == _uid_map(curr.get("series"))
        and str(prev_vis or "") == str(vis or "")
    )


def diff_uid_maps(previous: dict[str, str], current: dict[str, str]) -> tuple[list[str], list[str]]:
    """Return (upsert_uids, delete_uids) by comparing uid → fingerprint maps."""
    prev = _uid_map(previous)
    curr = _uid_map(current)
    upsert = sorted(uid for uid, digest in curr.items() if prev.get(uid) != digest)
    delete = sorted(uid for uid in prev if uid not in curr)
    return upsert, delete


def grants_content_hash(grants: list[dict[str, str]]) -> str:
    rows = sorted(
        ({"handle": str(item.get("handle") or ""), "visibility": str(item.get("visibility") or "")} for item in grants),
        key=lambda row: row["handle"].casefold(),
    )
    encoded = json.dumps(rows, ensure_ascii=True, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def json_array_text(value: Any) -> str:
    """Normalize a JSON-array field to compact text (``[]`` if empty/invalid)."""
    if isinstance(value, str):
        return value.strip() or "[]"
    if value is None:
        return "[]"
    if isinstance(value, list):
        try:
            return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        except (TypeError, ValueError):
            return "[]"
    parsed = parse_json_list(value)
    if parsed:
        try:
            return json.dumps(parsed, ensure_ascii=False, separators=(",", ":"))
        except (TypeError, ValueError):
            return "[]"
    try:
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    except (TypeError, ValueError):
        return "[]"
