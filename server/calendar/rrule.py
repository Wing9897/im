"""Recurring-only RRULE validation and query-time occurrence expansion.

Recurring tasks never run the LLM and never create analysis scheduler jobs. Their
RRULE is expanded only when the frontend calendar view queries a time range.
Expansion uses a fixed synthetic DTSTART anchor (never persisted) so results are
stable while scrolling.

``event_start_time`` / ``event_end_time`` as bare ``HH:MM`` are **system-local**
wall clocks (same host TZ as the assistant clock). Expanded ``startTime`` /
``endTime`` on the wire are absolute UTC (``…Z``), matching user_events and
analysis events.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, time, timedelta, timezone, tzinfo
from io import StringIO
from typing import Any, Mapping, Sequence
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from dateutil import rrule as du_rrule
from dateutil import tz as du_tz

from server.time_iso import parse_iso, to_iso_z
from server.util import parse_json_list, task_value

# Private module alias used by production paths and property tests in this file.
_iso_z = to_iso_z

logger = logging.getLogger(__name__)

#: Shared occurrence budget per request across all tasks.
MAX_OCCURRENCES = 1000

#: Fixed synthetic DTSTART date (not persisted).
ANCHOR_DATE = "20000101"

#: RRULE components accepted by validate_rrule.
_ALLOWED_COMPONENTS = {"FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "BYMONTH", "UNTIL", "COUNT"}

#: Day-grained frequencies only (UI + product intent). Sub-day FREQ values are rejected on write.
_ALLOWED_FREQS = frozenset({"DAILY", "WEEKLY", "MONTHLY", "YEARLY"})


_UNTIL_Z_RE = re.compile(r"(UNTIL=[0-9T]+)Z", re.IGNORECASE)


def _naive_rule(rule: str) -> str:
    """Strip the Z from UNTIL so the whole rule stays offset-naive (local wall)."""
    return _UNTIL_Z_RE.sub(r"\1", rule)


def _system_tzinfo() -> tzinfo:
    """Host system timezone (same authority as assistant / analysis clocks)."""
    return datetime.now().astimezone().tzinfo or timezone.utc


class RruleValidationError(ValueError):
    """Raised by validate_rrule with a machine-friendly ``code``."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def validate_rrule(rule: str | None) -> None:
    """Validate an RRULE string; raises RruleValidationError on any problem.

    Check order mirrors the reference implementation: empty → unsupported
    component → UNTIL/COUNT conflict → range checks → actual parse.
    """
    text = (rule or "").strip()
    if not text:
        raise RruleValidationError("empty", "RRULE is empty")
    if text.upper().startswith("RRULE:"):
        raise RruleValidationError(
            "rrule_prefix",
            "RRULE must not include an 'RRULE:' prefix",
        )

    parts: dict[str, str] = {}
    for chunk in text.split(";"):
        if not chunk:
            continue
        if "=" not in chunk:
            raise RruleValidationError("malformed", f"Malformed RRULE component: {chunk}")
        key, value = chunk.split("=", 1)
        key = key.strip().upper()
        if key not in _ALLOWED_COMPONENTS:
            raise RruleValidationError("unsupported_component", f"Unsupported RRULE component: {key}")
        parts[key] = value.strip()

    if "FREQ" not in parts:
        raise RruleValidationError("missing_freq", "RRULE must include FREQ")
    freq = parts["FREQ"].upper()
    if freq not in _ALLOWED_FREQS:
        raise RruleValidationError(
            "unsupported_freq",
            f"Unsupported FREQ: {parts['FREQ']} (allowed: DAILY, WEEKLY, MONTHLY, YEARLY)",
        )
    if "UNTIL" in parts and "COUNT" in parts:
        raise RruleValidationError("until_count_conflict", "RRULE cannot include both UNTIL and COUNT")

    def _int_or_error(key: str, raw: str) -> int:
        try:
            return int(raw)
        except ValueError:
            raise RruleValidationError("out_of_range", f"{key} must be an integer") from None

    if "INTERVAL" in parts:
        interval = _int_or_error("INTERVAL", parts["INTERVAL"])
        if not 1 <= interval <= 999:
            raise RruleValidationError("out_of_range", "INTERVAL must be 1-999")
    if "COUNT" in parts:
        count = _int_or_error("COUNT", parts["COUNT"])
        if not 1 <= count <= 9999:
            raise RruleValidationError("out_of_range", "COUNT must be 1-9999")
    if "BYMONTH" in parts:
        for raw in parts["BYMONTH"].split(","):
            month = _int_or_error("BYMONTH", raw)
            if not 1 <= month <= 12:
                raise RruleValidationError("out_of_range", "BYMONTH must be 1-12")
    if "BYMONTHDAY" in parts:
        for raw in parts["BYMONTHDAY"].split(","):
            day = _int_or_error("BYMONTHDAY", raw)
            if day == 0 or not -31 <= day <= 31:
                raise RruleValidationError("out_of_range", "BYMONTHDAY must be -31..-1 or 1..31")

    naive_text = _naive_rule(text)
    try:
        du_rrule.rrulestr(f"DTSTART:{ANCHOR_DATE}T000000\nRRULE:{naive_text}")
    except (ValueError, TypeError) as exc:
        raise RruleValidationError("parse_error", f"RRULE failed to parse: {exc}") from exc


# ── expansion ────────────────────────────────────────────────────────────


_TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})$")


def _extract_time_of_day(value: Any, *, local_tz: tzinfo | None = None) -> time | None:
    """Time-of-day from bare ``HH:MM`` (system-local wall) or an absolute ISO.

    ISO values are converted to ``local_tz`` (default: host system) before taking
    the clock face, so absolute instants stay consistent with other event types.
    """
    zone = local_tz or _system_tzinfo()
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


def _task_timezone(task: Mapping[str, Any]) -> tzinfo:
    raw = str(task_value(task, "event_timezone") or "").strip()
    if not raw or raw == "floating":
        return _system_tzinfo()
    if raw.upper() in {"UTC", "ETC/UTC", "GMT"}:
        return timezone.utc
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
        return _system_tzinfo()


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
        parsed_rule = du_rrule.rrulestr(rule, dtstart=anchor)
        rule_set = du_rrule.rruleset()
        if isinstance(parsed_rule, du_rrule.rruleset):
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

        range_start_utc = range_start.astimezone(timezone.utc)
        range_end_utc = range_end.astimezone(timezone.utc)
        if is_all_day:
            window_start = range_start_utc.replace(tzinfo=None)
            window_end = range_end_utc.replace(tzinfo=None)
        else:
            window_start = range_start_utc.astimezone(zone)
            window_end = range_end_utc.astimezone(zone)
        duration = _imported_duration(task, is_all_day=is_all_day)
        raw_occurrences = rule_set.xafter(window_start - timedelta(seconds=1), count=budget + 2, inc=False)
        task_id = str(task_value(task, "id") or "")
        task_name = str(task_value(task, "name") or "")
        results: list[dict[str, Any]] = []
        for occurrence in raw_occurrences:
            if occurrence > window_end + timedelta(seconds=1):
                break
            if occurrence.tzinfo is None and not is_all_day:
                occurrence = occurrence.replace(tzinfo=zone)
            if is_all_day:
                start_dt = datetime.combine(occurrence.date(), time(0, 0), tzinfo=timezone.utc)
                end_dt = start_dt + duration
            else:
                start_dt = occurrence.astimezone(timezone.utc)
                end_dt = (occurrence + duration).astimezone(timezone.utc)
            if start_dt < range_start_utc or start_dt > range_end_utc:
                continue
            results.append(
                {
                    "id": f"{task_id}:{start_dt.strftime('%Y%m%dT%H%M%SZ')}",
                    "taskId": task_id,
                    "taskName": task_name,
                    "title": task_name,
                    "startTime": _iso_z(start_dt),
                    "endTime": _iso_z(end_dt),
                    "isAllDay": is_all_day,
                    "timezone": task_value(task, "event_timezone"),
                    "location": task_value(task, "event_location") or None,
                    "description": task_value(task, "event_description") or None,
                    "rrule": rule,
                }
            )
            if len(results) >= budget:
                break
        return results
    except (ValueError, TypeError, OverflowError) as exc:
        logger.warning("Skipping imported calendar task %s: RRULE expansion failed (%s)", task_value(task, "id"), exc)
        return []


def expand_task_occurrences(
    task: Mapping[str, Any],
    range_start: datetime,
    range_end: datetime,
    budget: int,
) -> list[dict[str, Any]]:
    """Expand a single calendar task's RRULE inside [range_start, range_end].

    Returns CalendarOccurrence dicts (camelCase). Any parse failure returns []
    so one bad task never breaks the whole request.

    Recurrence calendar days and ``HH:MM`` clocks are interpreted in the host
    system timezone; wire ``startTime`` / ``endTime`` are UTC.
    """
    if budget <= 0:
        return []

    rule = str(task_value(task, "rrule") or "").strip()
    if not rule:
        return []
    if rule.upper().startswith("RRULE:"):
        # Writers reject the prefix; refuse to expand non-canonical stored forms.
        return []
    if str(task_value(task, "event_start_local") or "").strip():
        return _expand_imported_occurrences(task, range_start, range_end, budget)

    local_tz = _system_tzinfo()
    is_all_day = bool(task_value(task, "event_is_all_day"))
    start_tod = (
        time(0, 0)
        if is_all_day
        else (_extract_time_of_day(task_value(task, "event_start_time"), local_tz=local_tz) or time(0, 0))
    )
    task_id = str(task_value(task, "id") or "")
    task_name = str(task_value(task, "name") or "")
    location = task_value(task, "event_location")
    description = task_value(task, "event_description")
    end_tod = _extract_time_of_day(task_value(task, "event_end_time"), local_tz=local_tz) if not is_all_day else None

    occurrences: list[dict[str, Any]] = []
    try:
        # Naive DTSTART: dateutil compares naive datetimes as local wall times.
        rule_set = du_rrule.rrulestr(
            f"DTSTART:{ANCHOR_DATE}T{start_tod.hour:02d}{start_tod.minute:02d}00\nRRULE:{_naive_rule(rule)}"
        )
        # Preserve the legacy one-second widened window while acquiring only
        # the bounded chronological prefix needed by this request's budget.
        range_start_utc = range_start.astimezone(timezone.utc)
        range_end_utc = range_end.astimezone(timezone.utc)
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

        for occurrence in raw_occurrences:
            if occurrence >= acquisition_end:
                break

            date_part = occurrence.date()
            if is_all_day:
                start_dt = datetime.combine(date_part, time(0, 0), tzinfo=local_tz).astimezone(timezone.utc)
                end_dt = datetime.combine(date_part, time(23, 59, 59), tzinfo=local_tz).astimezone(timezone.utc)
            else:
                start_dt = datetime.combine(date_part, start_tod, tzinfo=local_tz).astimezone(timezone.utc)
                if end_tod is not None:
                    end_dt = datetime.combine(date_part, end_tod, tzinfo=local_tz).astimezone(timezone.utc)
                    if end_dt < start_dt:
                        end_dt = start_dt
                else:
                    end_dt = start_dt
            # The acquisition window is widened by one second to preserve
            # inclusive second-precision boundaries. Filter against the exact
            # caller range before materializing the result dictionary.
            if start_dt < range_start_utc or start_dt > range_end_utc:
                continue
            occurrences.append(
                {
                    "id": f"{task_id}:{start_dt.strftime('%Y%m%dT%H%M%SZ')}",
                    "taskId": task_id,
                    "taskName": task_name,
                    "title": task_name,
                    "startTime": _iso_z(start_dt),
                    "endTime": _iso_z(end_dt),
                    "isAllDay": is_all_day,
                    "location": location if location else None,
                    "description": description if description else None,
                    "rrule": rule,
                }
            )
            if len(occurrences) >= budget:
                break
    except (ValueError, TypeError, OverflowError) as exc:
        logger.warning(
            "Skipping calendar task %s: RRULE expansion failed (%s)",
            task_value(task, "id"),
            exc,
        )
        return []

    return occurrences


def expand_calendar_occurrences(
    tasks: Sequence[Mapping[str, Any]],
    range_start: datetime,
    range_end: datetime,
) -> list[dict[str, Any]]:
    """Expand all active calendar tasks under the shared MAX_OCCURRENCES budget."""
    results: list[dict[str, Any]] = []
    for task in tasks:
        if not bool(task.get("is_active", 1)):
            continue
        remaining = MAX_OCCURRENCES - len(results)
        if remaining <= 0:
            break
        results.extend(expand_task_occurrences(task, range_start, range_end, remaining))
    results.sort(key=lambda o: (o["startTime"], o["taskId"]))
    return results
