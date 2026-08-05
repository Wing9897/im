"""Private VEVENT decoding helpers for RFC 5545 ICS import."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterable

from server.calendar.rrule import RruleValidationError, validate_rrule
from server.time_iso import to_iso_z

logger = logging.getLogger(__name__)


def _text(component: Any, key: str) -> str:
    value = component.get(key)
    return str(value).strip() if value is not None else ""


def _property_tzid(prop: Any) -> str | None:
    params = getattr(prop, "params", None)
    if params is None:
        return None
    raw = params.get("TZID")
    text = str(raw).strip() if raw is not None else ""
    return text or None


def _local_string(value: date | datetime) -> str:
    if isinstance(value, datetime):
        return value.replace(tzinfo=None).isoformat(timespec="seconds")
    return value.isoformat()


def _canonical_value(
    value: date | datetime,
    *,
    warnings: list[Any],
) -> tuple[str, str, bool]:
    # Import here to avoid circular import with ics dataclasses at module load.
    from server.calendar.ics import IcsWarning

    if not isinstance(value, datetime):
        local = value.isoformat()
        return f"{local}T00:00:00Z", local, True
    local = _local_string(value)
    if value.tzinfo is None:
        local_zone = datetime.now().astimezone().tzinfo or timezone.utc
        value = value.replace(tzinfo=local_zone)
        warnings.append(
            IcsWarning(
                "floating_time_system_zone",
                "Floating DATE-TIME was interpreted in the server system timezone.",
            )
        )
    return to_iso_z(value), local, False


def _decoded(component: Any, name: str) -> Any:
    from server.calendar.ics import IcsParseError

    prop = component.get(name)
    if prop is None:
        return None
    try:
        return prop.dt
    except AttributeError:
        try:
            return component.decoded(name)
        except (TypeError, ValueError) as exc:
            raise IcsParseError(f"{name} could not be decoded: {exc}") from exc


def _date_values(component: Any, name: str, warnings: list[Any]) -> tuple[str, ...]:
    from server.calendar.ics import IcsWarning

    values: list[str] = []
    try:
        properties = component.getall(name)
    except AttributeError:
        raw = component.get(name)
        properties = [] if raw is None else (raw if isinstance(raw, list) else [raw])
    for prop in properties:
        dts = getattr(prop, "dts", None)
        entries: Iterable[Any]
        if dts is not None:
            entries = dts
        else:
            entries = [prop]
        for entry in entries:
            value = getattr(entry, "dt", entry)
            if isinstance(value, tuple):
                warnings.append(IcsWarning("unsupported_period", f"{name} PERIOD values are not imported."))
                continue
            if not isinstance(value, (date, datetime)):
                warnings.append(IcsWarning("invalid_recurrence_date", f"Invalid {name} value was ignored."))
                continue
            canonical, _local, is_all_day = _canonical_value(value, warnings=warnings)
            values.append(value.isoformat() if is_all_day else canonical)
    return tuple(sorted(set(values)))


def _rrule(component: Any) -> str | None:
    prop = component.get("RRULE")
    if prop is None:
        return None
    raw = prop.to_ical() if hasattr(prop, "to_ical") else str(prop)
    text = raw.decode("utf-8") if isinstance(raw, bytes) else str(raw)
    return text.strip().removeprefix("RRULE:")


def _fingerprint(event: Any) -> str:
    payload = json.dumps(event.comparable(), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _synthetic_uid(
    *,
    title: str,
    start_time: str,
    end_time: str | None,
    is_all_day: bool,
    location: str,
) -> str:
    """Stable identity for VEVENTs that omit UID (common in holiday calendars)."""
    payload = json.dumps(
        {
            "title": title,
            "startTime": start_time,
            "endTime": end_time,
            "isAllDay": is_all_day,
            "location": location,
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:32]
    return f"synth-{digest}"


def _parse_event(component: Any, timezone_definitions: dict[str, str]) -> Any:
    from dataclasses import replace

    from server.calendar.ics import IcsParseError, IcsWarning, ParsedIcsEvent

    warnings: list[IcsWarning] = []
    real_uid = _text(component, "UID")
    event_label = real_uid or "without identity"
    supported = True
    if component.get("RECURRENCE-ID") is not None:
        supported = False
        warnings.append(
            IcsWarning(
                "unsupported_recurrence_id",
                "This exception to a recurring series is shown but not imported; the base series is unchanged.",
            )
        )

    start_prop = component.get("DTSTART")
    start_value = _decoded(component, "DTSTART")
    if not isinstance(start_value, (date, datetime)):
        raise IcsParseError(f"VEVENT {event_label!r} has no valid DTSTART")
    start_time, start_local, is_all_day = _canonical_value(start_value, warnings=warnings)
    timezone_id = (
        None
        if not isinstance(start_value, datetime)
        else (_property_tzid(start_prop) or ("floating" if start_value.tzinfo is None else "UTC"))
    )

    end_value = _decoded(component, "DTEND")
    if end_value is None and component.get("DURATION") is not None:
        try:
            duration = component.decoded("DURATION")
            if isinstance(duration, timedelta):
                end_value = start_value + duration
        except (TypeError, ValueError, OverflowError):
            warnings.append(IcsWarning("invalid_duration", "Event duration could not be read and was ignored."))
    if end_value is None and is_all_day:
        end_value = start_value + timedelta(days=1)

    end_time: str | None = None
    end_local: str | None = None
    if end_value is not None:
        if not isinstance(end_value, (date, datetime)):
            raise IcsParseError(f"VEVENT {event_label!r} has an invalid DTEND")
        end_time, end_local, end_all_day = _canonical_value(end_value, warnings=warnings)
        if end_all_day != is_all_day:
            supported = False
            warnings.append(
                IcsWarning(
                    "mixed_date_types",
                    "This event mixes all-day and timed values and cannot be imported safely.",
                )
            )

    rule = _rrule(component)
    if rule:
        try:
            validate_rrule(rule)
        except RruleValidationError as exc:
            supported = False
            warnings.append(IcsWarning(f"unsupported_rrule_{exc.code}", str(exc)))

    exdates = _date_values(component, "EXDATE", warnings)
    rdates = _date_values(component, "RDATE", warnings)
    if (exdates or rdates) and not rule:
        warnings.append(
            IcsWarning(
                "orphan_recurrence_dates",
                "Excluded or extra dates without a recurrence rule are kept but have no effect.",
            )
        )

    title = _text(component, "SUMMARY") or "(Untitled event)"
    location = _text(component, "LOCATION")
    if real_uid:
        uid = real_uid
    else:
        uid = _synthetic_uid(
            title=title,
            start_time=start_time,
            end_time=end_time,
            is_all_day=is_all_day,
            location=location,
        )
        logger.debug("VEVENT has no UID; using synthetic uid=%s title=%r", uid, title)

    event = ParsedIcsEvent(
        uid=uid,
        title=title,
        description=_text(component, "DESCRIPTION"),
        location=location,
        start_time=start_time,
        end_time=end_time,
        is_all_day=is_all_day,
        timezone_id=timezone_id,
        timezone_ical=timezone_definitions.get(timezone_id or ""),
        start_local=start_local,
        end_local=end_local,
        rrule=rule,
        exdates=exdates,
        rdates=rdates,
        fingerprint="",
        supported=supported,
        warnings=tuple(warnings),
    )
    return replace(event, fingerprint=_fingerprint(event))
