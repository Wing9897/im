"""Imported ICS recurrence expansion (stored ``event_start_local`` anchors)."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import UTC, date, datetime, time, timedelta, tzinfo
from io import StringIO
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from dateutil import tz as du_tz

from server.calendar.rrule_validate import _naive_rule
from server.domain.notify_prefs import normalize_notify_pref
from server.time_iso import parse_iso
from server.util import parse_json_list, task_value

logger = logging.getLogger(__name__)


def _task_timezone(task: Mapping[str, Any]) -> tzinfo:
    # Lazy facade lookup so tests can monkeypatch ``server.calendar.rrule._system_tzinfo``.
    from server.calendar import rrule as rrule_mod

    raw = str(task_value(task, "event_timezone") or "").strip()
    if not raw or raw == "floating":
        return rrule_mod._system_tzinfo()
    if raw.upper() in {"UTC", "ETC/UTC", "GMT"}:
        return UTC
    try:
        return ZoneInfo(raw)
    except (ZoneInfoNotFoundError, ValueError):
        definition = str(task_value(task, "event_timezone_ical") or "").strip()
        if definition:
            try:
                resolved = du_tz.tzical(StringIO(definition)).get(raw)
                if resolved is not None:
                    return resolved
            except (ValueError, TypeError):
                logger.warning("Stored VTIMEZONE %s could not be parsed", raw, exc_info=True)
        logger.warning("Unknown calendar TZID %s; using the system timezone", raw)
        return rrule_mod._system_tzinfo()


def _stored_recurrence_datetime(value: Any, *, zone: tzinfo, is_all_day: bool) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    if is_all_day:
        try:
            return datetime.combine(date.fromisoformat(text[:10]), time(0, 0), tzinfo=zone)
        except ValueError:
            return None
    try:
        local = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return local.replace(tzinfo=zone) if local.tzinfo is None else local.astimezone(zone)


def _imported_duration(task: Mapping[str, Any], *, is_all_day: bool) -> timedelta:
    raw_start = task_value(task, "event_start_local")
    raw_end = task_value(task, "event_end_local")
    if is_all_day:
        try:
            start_date = date.fromisoformat(str(raw_start)[:10])
            end_date = date.fromisoformat(str(raw_end)[:10])
            return max(end_date - start_date, timedelta(days=1))
        except (TypeError, ValueError):
            return timedelta(days=1)
    try:
        start_local = datetime.fromisoformat(str(raw_start))
        end_local = datetime.fromisoformat(str(raw_end))
        return max(end_local - start_local, timedelta(0))
    except (TypeError, ValueError):
        start = parse_iso(task_value(task, "event_start_time"))
        end = parse_iso(task_value(task, "event_end_time"))
        if start is None or end is None:
            return timedelta(0)
        return max(end - start, timedelta(0))


def _expand_imported_occurrences(
    task: Mapping[str, Any],
    range_start: datetime,
    range_end: datetime,
    budget: int,
) -> list[dict[str, Any]]:
    from server.calendar import rrule as rrule_mod

    rule = str(task_value(task, "rrule") or "").strip()
    is_all_day = bool(task_value(task, "event_is_all_day"))
    zone = _task_timezone(task)
    anchor = _stored_recurrence_datetime(
        task_value(task, "event_start_local"),
        zone=zone,
        is_all_day=is_all_day,
    )
    if anchor is None:
        return []
    if is_all_day:
        # RFC DATE recurrences are floating calendar dates, not instants.
        anchor = anchor.replace(tzinfo=None)

    try:
        # dateutil rejects UTC UNTIL (...Z) when DTSTART is naive. All-day /
        # floating DATE anchors are naive; the timeline UI still emits
        # UNTIL=...Z, so strip Z to keep the whole rule offset-naive.
        rule_for_parse = _naive_rule(rule) if anchor.tzinfo is None else rule
        parsed_rule = rrule_mod.du_rrule.rrulestr(rule_for_parse, dtstart=anchor)
        rule_set = rrule_mod.du_rrule.rruleset()
        if isinstance(parsed_rule, rrule_mod.du_rrule.rruleset):
            rule_set = parsed_rule
        else:
            rule_set.rrule(parsed_rule)
        for value in parse_json_list(task_value(task, "event_exdates_json")):
            excluded = _stored_recurrence_datetime(value, zone=zone, is_all_day=is_all_day)
            if excluded is not None:
                if is_all_day:
                    excluded = excluded.replace(tzinfo=None)
                rule_set.exdate(excluded)
        for value in parse_json_list(task_value(task, "event_rdates_json")):
            included = _stored_recurrence_datetime(value, zone=zone, is_all_day=is_all_day)
            if included is not None:
                if is_all_day:
                    included = included.replace(tzinfo=None)
                rule_set.rdate(included)

        range_start_utc = range_start.astimezone(UTC)
        range_end_utc = range_end.astimezone(UTC)
        if is_all_day:
            window_start = range_start_utc.replace(tzinfo=None)
            window_end = range_end_utc.replace(tzinfo=None)
        else:
            window_start = range_start_utc.astimezone(zone)
            window_end = range_end_utc.astimezone(zone)
        duration = _imported_duration(task, is_all_day=is_all_day)
        raw_occurrences = rule_set.xafter(window_start - timedelta(seconds=1), count=budget + 2, inc=False)
        series_id = str(task_value(task, "id") or "")
        series_name = str(task_value(task, "name") or "")
        raw_item = task_value(task, "item_id")
        item_id = str(raw_item).strip() if isinstance(raw_item, str) and str(raw_item).strip() else None
        raw_workset = task_value(task, "workset_id")
        workset_id = str(raw_workset).strip() if raw_workset not in (None, "") else None
        notify_pref = normalize_notify_pref(task_value(task, "notify_pref"))
        built: list[tuple[Any, dict[str, Any]]] = []
        for occurrence in raw_occurrences:
            if occurrence > window_end + timedelta(seconds=1):
                break
            if occurrence.tzinfo is None and not is_all_day:
                occurrence = occurrence.replace(tzinfo=zone)
            if is_all_day:
                # ICS DATE values stay on the UTC calendar day; floating/manual
                # all-day plans use the host local wall (match the non-import path).
                imported = bool(str(task_value(task, "ics_source") or "").strip())
                if imported:
                    start_dt = datetime.combine(occurrence.date(), time(0, 0), tzinfo=UTC)
                    end_dt = start_dt + duration
                else:
                    start_dt = datetime.combine(occurrence.date(), time(0, 0), tzinfo=zone).astimezone(UTC)
                    end_dt = datetime.combine(occurrence.date(), time(23, 59, 59), tzinfo=zone).astimezone(UTC)
            else:
                start_dt = occurrence.astimezone(UTC)
                end_dt = (occurrence + duration).astimezone(UTC)
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
                        "timezone": (
                            None
                            if task_value(task, "event_timezone") in (None, "", "floating")
                            else task_value(task, "event_timezone")
                        ),
                        "location": task_value(task, "event_location") or None,
                        "description": task_value(task, "event_description") or None,
                        "rrule": rule,
                        "worksetId": workset_id,
                        "itemId": item_id,
                        "notifyPref": notify_pref,
                    },
                )
            )
            if len(built) >= budget:
                break
        results: list[dict[str, Any]] = []
        for occurrence, item in built:
            item["isLastOccurrence"] = rule_set.after(occurrence) is None
            results.append(item)
        return results
    except (ValueError, TypeError, OverflowError) as exc:
        logger.warning("Skipping recurring task %s: RRULE expansion failed (%s)", task_value(task, "id"), exc)
        return []
