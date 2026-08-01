"""Central RFC 5545 parsing and import-preview helpers.

``icalendar`` owns content-line unfolding, escaping, parameters, VTIMEZONE
resolution and value decoding. This module only maps the supported VEVENT
subset into the application's UTC/all-day recurrence model.
"""

from __future__ import annotations

import hashlib
import json
import logging
from collections import Counter
from dataclasses import dataclass, field, replace
from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterable

from icalendar import Calendar

from server.calendar.rrule import RruleValidationError, validate_rrule
from server.time_iso import to_iso_z

MAX_ICS_BYTES = 2 * 1024 * 1024
MAX_ICS_EVENTS = 2_000
DEFAULT_ICS_SOURCE = "ics"

logger = logging.getLogger(__name__)


class IcsParseError(ValueError):
    """Invalid or unsafe calendar input."""


@dataclass(frozen=True, slots=True)
class IcsWarning:
    code: str
    message: str

    def wire(self) -> dict[str, str]:
        return {"code": self.code, "message": self.message}


@dataclass(frozen=True, slots=True)
class ParsedIcsEvent:
    uid: str
    title: str
    description: str
    location: str
    start_time: str
    end_time: str | None
    is_all_day: bool
    timezone_id: str | None
    timezone_ical: str | None
    start_local: str
    end_local: str | None
    rrule: str | None
    exdates: tuple[str, ...]
    rdates: tuple[str, ...]
    fingerprint: str
    supported: bool = True
    warnings: tuple[IcsWarning, ...] = field(default_factory=tuple)

    @property
    def target_type(self) -> str:
        return "recurring_task" if self.rrule else "user_event"

    def comparable(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "description": self.description,
            "location": self.location,
            "startTime": self.start_time,
            "endTime": self.end_time,
            "isAllDay": self.is_all_day,
            "timezone": self.timezone_id,
            "timezoneIcal": self.timezone_ical,
            "startLocal": self.start_local,
            "endLocal": self.end_local,
            "rrule": self.rrule,
            "exdates": list(self.exdates),
            "rdates": list(self.rdates),
        }


@dataclass(frozen=True, slots=True)
class ParsedCalendar:
    calendar_name: str | None
    events: tuple[ParsedIcsEvent, ...]
    warnings: tuple[IcsWarning, ...] = field(default_factory=tuple)


def normalize_ics_source(value: str | None) -> str:
    source = (value or DEFAULT_ICS_SOURCE).strip()
    if not source:
        source = DEFAULT_ICS_SOURCE
    if len(source) > 200:
        raise IcsParseError("sourceId must be at most 200 characters")
    return source


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
    warnings: list[IcsWarning],
) -> tuple[str, str, bool]:
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


def _date_values(component: Any, name: str, warnings: list[IcsWarning]) -> tuple[str, ...]:
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


def _fingerprint(event: ParsedIcsEvent) -> str:
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


def _parse_event(component: Any, timezone_definitions: dict[str, str]) -> ParsedIcsEvent:
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


def parse_ics(content: str | bytes) -> ParsedCalendar:
    raw = content.encode("utf-8") if isinstance(content, str) else bytes(content)
    if len(raw) > MAX_ICS_BYTES:
        raise IcsParseError(f"ICS content exceeds the {MAX_ICS_BYTES}-byte limit")
    if not raw.strip():
        raise IcsParseError("ICS content is empty")
    try:
        calendar = Calendar.from_ical(raw)
    except (ValueError, TypeError, UnicodeError) as exc:
        raise IcsParseError(f"Invalid ICS content: {exc}") from exc

    components = list(calendar.walk("VEVENT"))
    if len(components) > MAX_ICS_EVENTS:
        raise IcsParseError(f"ICS content exceeds the {MAX_ICS_EVENTS}-event limit")

    events: list[ParsedIcsEvent] = []
    global_warnings: list[IcsWarning] = []
    timezone_definitions: dict[str, str] = {}
    for component in calendar.walk("VTIMEZONE"):
        tzid = _text(component, "TZID")
        if not tzid:
            continue
        raw_definition = component.to_ical()
        timezone_definitions[tzid] = (
            raw_definition.decode("utf-8") if isinstance(raw_definition, bytes) else str(raw_definition)
        )
    for index, component in enumerate(components):
        try:
            events.append(_parse_event(component, timezone_definitions))
        except IcsParseError as exc:
            global_warnings.append(IcsWarning("invalid_event", f"VEVENT #{index + 1}: {exc}"))

    duplicate_uids = {
        uid for uid, count in Counter(event.uid for event in events if event.supported).items() if count > 1
    }
    if duplicate_uids:
        events = [
            replace(
                event,
                supported=False,
                warnings=event.warnings
                + (
                    IcsWarning(
                        "duplicate_uid_in_file",
                        "This file contains duplicate events that cannot be distinguished; they are skipped.",
                    ),
                ),
            )
            if event.uid in duplicate_uids and event.supported
            else event
            for event in events
        ]

    name = _text(calendar, "X-WR-CALNAME") or None
    return ParsedCalendar(calendar_name=name, events=tuple(events), warnings=tuple(global_warnings))
