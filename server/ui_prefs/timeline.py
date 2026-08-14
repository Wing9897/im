"""Timeline annotations (event statuses + time overrides) prefs."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from server.db.database import Database
from server.ui_prefs.common import (
    KEY_TIMELINE_ANNOTATIONS,
    _read_json,
    _write_json,
)

_TIMELINE_STATUSES = frozenset({"pending", "confirmed", "completed"})
#: Cap map sizes so a runaway client cannot fill ui_prefs.
MAX_TIMELINE_ANNOTATION_ENTRIES = 5_000
_ISO_TIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$")


def _is_iso_time(value: Any) -> bool:
    return isinstance(value, str) and bool(_ISO_TIME_RE.match(value.strip()))


def sanitize_timeline_annotations(raw: Any) -> dict[str, Any]:
    data = raw if isinstance(raw, Mapping) else {}
    statuses_raw = data.get("eventStatuses")
    overrides_raw = data.get("eventTimeOverrides")

    event_statuses: dict[str, str] = {}
    if isinstance(statuses_raw, Mapping):
        for key, value in statuses_raw.items():
            if not isinstance(key, str) or not key.strip():
                continue
            if value in _TIMELINE_STATUSES:
                event_statuses[key.strip()] = value
            if len(event_statuses) >= MAX_TIMELINE_ANNOTATION_ENTRIES:
                break

    event_time_overrides: dict[str, dict[str, Any]] = {}
    if isinstance(overrides_raw, Mapping):
        for key, value in overrides_raw.items():
            if not isinstance(key, str) or not key.strip():
                continue
            if not isinstance(value, Mapping):
                continue
            start = value.get("startTime")
            end = value.get("endTime")
            if not _is_iso_time(start):
                continue
            end_clean: str | None
            if end is None or end == "":
                end_clean = None
            elif _is_iso_time(end):
                end_clean = str(end).strip()
            else:
                continue
            event_time_overrides[key.strip()] = {
                "startTime": str(start).strip(),
                "endTime": end_clean,
            }
            if len(event_time_overrides) >= MAX_TIMELINE_ANNOTATION_ENTRIES:
                break

    return {
        "eventStatuses": event_statuses,
        "eventTimeOverrides": event_time_overrides,
    }


async def get_timeline_annotations(db: Database) -> dict[str, Any]:
    raw = await _read_json(db, KEY_TIMELINE_ANNOTATIONS)
    if raw is None:
        return {
            "configured": False,
            "eventStatuses": None,
            "eventTimeOverrides": None,
        }
    clean = sanitize_timeline_annotations(raw)
    return {"configured": True, **clean}


async def put_timeline_annotations(db: Database, payload: Any) -> dict[str, Any]:
    clean = sanitize_timeline_annotations(payload)
    await _write_json(db, KEY_TIMELINE_ANNOTATIONS, clean)
    return {"configured": True, **clean}
