"""Synthetic-anchor RRULE expansion and multi-task budget orchestration."""

from __future__ import annotations

import logging
import re
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime, time, timedelta, tzinfo
from typing import Any

from server.calendar.occurrence_span import roll_end_if_overnight
from server.calendar.rrule_expand_imported import _expand_imported_occurrences
from server.calendar.rrule_validate import ANCHOR_DATE, MAX_OCCURRENCES, _naive_rule
from server.time_iso import parse_iso
from server.util import task_value

logger = logging.getLogger(__name__)

_TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})$")


def _task_item_id(task: Mapping[str, Any]) -> str | None:
    """Optional parent inventory item id from ``recurring_schedules.item_id``."""
    raw = task_value(task, "item_id")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None


def _extract_time_of_day(value: Any, *, local_tz: tzinfo | None = None) -> time | None:
    """Time-of-day from bare ``HH:MM`` (system-local wall) or an absolute ISO.

    ISO values are converted to ``local_tz`` (default: host system) before taking
    the clock face, so absolute instants stay consistent with other event types.
    """
    from server.calendar import rrule as rrule_mod

    zone = local_tz or rrule_mod._system_tzinfo()
    parsed = parse_iso(value)
    if parsed is not None:
        local = parsed.astimezone(zone)
        return time(local.hour, local.minute)
    if isinstance(value, str):
        match = _TIME_RE.fullmatch(value.strip())
        if match:
            hour, minute = int(match.group(1)), int(match.group(2))
            if hour < 24 and minute < 60:
                return time(hour, minute)
    return None


def expand_series_occurrences(
    series: Mapping[str, Any],
    range_start: datetime,
    range_end: datetime,
    budget: int,
) -> list[dict[str, Any]]:
    """Expand a single recurring series RRULE inside [range_start, range_end].

    Returns CalendarOccurrence dicts (camelCase). Any parse failure returns []
    so one bad series never breaks the whole request.

    Recurrence calendar days and ``HH:MM`` clocks are interpreted in the host
    system timezone; wire ``startTime`` / ``endTime`` are UTC.
    """
    from server.calendar import rrule as rrule_mod

    if budget <= 0:
        return []

    rule = str(task_value(series, "rrule") or "").strip()
    if not rule:
        return []
    if rule.upper().startswith("RRULE:"):
        # Writers reject the prefix; refuse to expand non-canonical stored forms.
        return []
    if str(task_value(series, "event_start_local") or "").strip():
        return _expand_imported_occurrences(series, range_start, range_end, budget)

    local_tz = rrule_mod._system_tzinfo()
    is_all_day = bool(task_value(series, "event_is_all_day"))
    start_tod = (
        time(0, 0)
        if is_all_day
        else (_extract_time_of_day(task_value(series, "event_start_time"), local_tz=local_tz) or time(0, 0))
    )
    series_id = str(task_value(series, "id") or "")
    series_name = str(task_value(series, "name") or "")
    location = task_value(series, "event_location")
    description = task_value(series, "event_description")
    item_id = _task_item_id(series)
    raw_workset = task_value(series, "workset_id")
    workset_id = str(raw_workset).strip() if raw_workset not in (None, "") else None
    end_tod = _extract_time_of_day(task_value(series, "event_end_time"), local_tz=local_tz) if not is_all_day else None

    occurrences: list[dict[str, Any]] = []
    try:
        # Naive DTSTART: dateutil compares naive datetimes as local wall times.
        rule_set = rrule_mod.du_rrule.rrulestr(
            f"DTSTART:{ANCHOR_DATE}T{start_tod.hour:02d}{start_tod.minute:02d}00\nRRULE:{_naive_rule(rule)}"
        )
        # Preserve the legacy one-second widened window while acquiring only
        # the bounded chronological prefix needed by this request's budget.
        range_start_utc = range_start.astimezone(UTC)
        range_end_utc = range_end.astimezone(UTC)
        range_start_local = range_start.astimezone(local_tz)
        range_end_local = range_end.astimezone(local_tz)
        window_start = range_start_local.replace(tzinfo=None)
        window_end = range_end_local.replace(tzinfo=None)
        acquisition_end = window_end + timedelta(seconds=1)
        raw_occurrences = rule_set.xafter(
            window_start - timedelta(seconds=1),
            count=budget + 2,
            inc=False,
        )

        built: list[tuple[datetime, dict[str, Any]]] = []
        for occurrence in raw_occurrences:
            if occurrence >= acquisition_end:
                break

            date_part = occurrence.date()
            if is_all_day:
                start_dt = datetime.combine(date_part, time(0, 0), tzinfo=local_tz).astimezone(UTC)
                end_dt = datetime.combine(date_part, time(23, 59, 59), tzinfo=local_tz).astimezone(UTC)
            else:
                start_local = datetime.combine(date_part, start_tod, tzinfo=local_tz)
                start_dt = start_local.astimezone(UTC)
                if end_tod is not None:
                    end_local = roll_end_if_overnight(
                        start_local,
                        datetime.combine(date_part, end_tod, tzinfo=local_tz),
                    )
                    end_dt = end_local.astimezone(UTC)
                else:
                    end_dt = start_dt
            # The acquisition window is widened by one second to preserve
            # inclusive second-precision boundaries. Filter against the exact
            # caller range before materializing the result dictionary.
            if start_dt < range_start_utc or start_dt > range_end_utc:
                continue
            built.append(
                (
                    occurrence,
                    {
                        "id": f"{series_id}:{start_dt.strftime('%Y%m%dT%H%M%SZ')}",
                        "seriesId": series_id,
                        "taskName": series_name,
                        "title": series_name,
                        "startTime": rrule_mod._iso_z(start_dt),
                        "endTime": rrule_mod._iso_z(end_dt),
                        "isAllDay": is_all_day,
                        "location": location if location else None,
                        "description": description if description else None,
                        "rrule": rule,
                        "worksetId": workset_id,
                        "itemId": item_id,
                    },
                )
            )
            if len(built) >= budget:
                break
        for occurrence, item in built:
            item["isLastOccurrence"] = rule_set.after(occurrence) is None
            occurrences.append(item)
    except (ValueError, TypeError, OverflowError) as exc:
        logger.warning(
            "Skipping calendar series %s: RRULE expansion failed (%s)",
            task_value(series, "id"),
            exc,
        )
        return []

    return occurrences


def expand_calendar_occurrences(
    series_rows: Sequence[Mapping[str, Any]],
    range_start: datetime,
    range_end: datetime,
) -> list[dict[str, Any]]:
    """Expand all active recurring series under the shared MAX_OCCURRENCES budget."""
    results: list[dict[str, Any]] = []
    for series in series_rows:
        if not bool(series.get("is_active", 1)):
            continue
        remaining = MAX_OCCURRENCES - len(results)
        if remaining <= 0:
            break
        results.extend(expand_series_occurrences(series, range_start, range_end, remaining))
    results.sort(key=lambda o: (o["startTime"], o["seriesId"]))
    return results
