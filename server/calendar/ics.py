"""Central RFC 5545 parsing and import-preview helpers.

``icalendar`` owns content-line unfolding, escaping, parameters, VTIMEZONE
resolution and value decoding. This module only maps the supported VEVENT
subset into the application's UTC/all-day recurrence model.

VEVENT decoding lives in ``ics_event``; constants and public API stay here
(Desktop ICS drift depends on this facade).
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field, replace
from typing import Any

from icalendar import Calendar

from server.calendar.ics_event import _parse_event, _text

MAX_ICS_BYTES = 2 * 1024 * 1024
MAX_ICS_EVENTS = 2_000
DEFAULT_ICS_SOURCE = "ics"


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
