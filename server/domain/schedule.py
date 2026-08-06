"""Unified schedule model: RRULE-shaped strings with purpose-gated consumers.

Two purposes share RRULE syntax but **never** share consumption paths:

- ``purpose=trigger`` — AI modes (``event`` / ``leaderboard`` / ``project`` /
  ``web_intel``). Stored on ``analysis_tasks.schedule_rrule``. Consumed
  **only** by the APScheduler next-run path. Sub-day FREQ (``SECONDLY`` /
  ``HOURLY``) is allowed. **Never** expanded into calendar occurrences /
  Board / Timeline month grids.
- ``purpose=calendar`` — ``analysis_mode=recurring`` series on
  ``recurring_schedules.rrule``. Day-grained FREQ only. Expanded at query
  time. **Never** registers an AI timer.

FE editor presets (``seconds_10`` / ``hourly`` / …) are a client convenience
layer that maps to/from trigger RRULE locally; the HTTP wire carries
``scheduleRrule`` only.
"""

from __future__ import annotations

from typing import Final, Literal

from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from server.domain.analysis_modes import (
    CHILD_RECURRING_MODE,
    SCHEDULABLE_ANALYSIS_MODES,
    get_analysis_mode_spec,
)
from server.domain.rrule_parts import parse_rrule_body_parts

SchedulePurpose = Literal["trigger", "calendar"]

#: FE editor preset vocabulary (maps to trigger RRULE locally; not on HTTP wire).
ALLOWED_SCHEDULE_PRESETS: Final[tuple[str, ...]] = (
    "seconds_10",
    "hourly",
    "daily",
    "weekly",
    "custom_seconds",
)

_DAY_MAP: Final[dict[int, str]] = {
    0: "sun",
    1: "mon",
    2: "tue",
    3: "wed",
    4: "thu",
    5: "fri",
    6: "sat",
}
_BYDAY_TO_PRESET: Final[dict[str, int]] = {
    "SU": 0,
    "MO": 1,
    "TU": 2,
    "WE": 3,
    "TH": 4,
    "FR": 5,
    "SA": 6,
}
_PRESET_TO_BYDAY: Final[dict[int, str]] = {value: key for key, value in _BYDAY_TO_PRESET.items()}

_TRIGGER_FREQS: Final[frozenset[str]] = frozenset({"SECONDLY", "MINUTELY", "HOURLY", "DAILY", "WEEKLY"})
_TRIGGER_COMPONENTS: Final[frozenset[str]] = frozenset({"FREQ", "INTERVAL", "BYDAY", "BYHOUR", "BYMINUTE", "BYSECOND"})


class ScheduleValidationError(ValueError):
    """Invalid trigger / calendar schedule description."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def schedule_purpose_for_mode(analysis_mode: str | None) -> SchedulePurpose | None:
    """Return the schedule purpose owned by ``analysis_mode``, or None if unknown."""
    spec = get_analysis_mode_spec(analysis_mode)
    if spec is None:
        return None
    if spec.pipeline == "rrule_expand":
        return "calendar"
    if spec.schedulable:
        return "trigger"
    return None


def may_calendar_expand(analysis_mode: str | None) -> bool:
    """Hard gate: only recurring (calendar-purpose) modes expand into occurrences."""
    return schedule_purpose_for_mode(analysis_mode) == "calendar"


def may_register_trigger(analysis_mode: str | None) -> bool:
    """Hard gate: only schedulable AI modes register APScheduler timers."""
    return analysis_mode in SCHEDULABLE_ANALYSIS_MODES


def parse_rrule_parts(rule: str) -> dict[str, str]:
    """Parse ``FREQ=…;INTERVAL=…`` body into upper-cased component map."""

    def _error(code: str, message: str) -> ScheduleValidationError:
        # Preserve the historical empty-message wording for trigger schedules.
        if code == "empty":
            return ScheduleValidationError(code, "Schedule RRULE is empty")
        return ScheduleValidationError(code, message)

    return parse_rrule_body_parts(rule, error=_error)


def validate_trigger_rrule(rule: str | None) -> str:
    """Validate a trigger-purpose RRULE; return canonical upper-FREQ body."""
    parts = parse_rrule_parts(rule or "")
    unknown = set(parts) - _TRIGGER_COMPONENTS
    if unknown:
        raise ScheduleValidationError(
            "unsupported_component",
            f"Unsupported trigger RRULE component: {sorted(unknown)[0]}",
        )
    freq = parts["FREQ"].upper()
    if freq not in _TRIGGER_FREQS:
        raise ScheduleValidationError(
            "unsupported_freq",
            f"Unsupported trigger FREQ: {freq}",
        )
    if "INTERVAL" in parts:
        try:
            interval = int(parts["INTERVAL"])
        except ValueError as exc:
            raise ScheduleValidationError("bad_interval", "INTERVAL must be an integer") from exc
        if interval < 1:
            raise ScheduleValidationError("bad_interval", "INTERVAL must be >= 1")
    if "BYHOUR" in parts:
        _require_int_range(parts["BYHOUR"], "BYHOUR", 0, 23)
    if "BYMINUTE" in parts:
        _require_int_range(parts["BYMINUTE"], "BYMINUTE", 0, 59)
    if "BYSECOND" in parts:
        _require_int_range(parts["BYSECOND"], "BYSECOND", 0, 59)
    if "BYDAY" in parts:
        day = parts["BYDAY"].upper()
        if day not in _BYDAY_TO_PRESET:
            raise ScheduleValidationError("bad_byday", f"Unsupported BYDAY: {parts['BYDAY']}")
        parts["BYDAY"] = day
    parts["FREQ"] = freq
    return ";".join(
        f"{key}={parts[key]}" for key in ("FREQ", "INTERVAL", "BYDAY", "BYHOUR", "BYMINUTE", "BYSECOND") if key in parts
    )


def _require_int_range(raw: str, label: str, minimum: int, maximum: int) -> int:
    try:
        value = int(raw)
    except ValueError as exc:
        raise ScheduleValidationError("bad_int", f"{label} must be an integer") from exc
    if value < minimum or value > maximum:
        raise ScheduleValidationError("bad_range", f"{label} must be between {minimum} and {maximum}")
    return value


def preset_to_trigger_rrule(schedule_type: str, schedule_value: str | None) -> str:
    """Map FE editor presets (``seconds_10`` / …) to a trigger-purpose RRULE body."""
    if schedule_type == "seconds_10":
        return "FREQ=SECONDLY;INTERVAL=10"
    if schedule_type == "hourly":
        return "FREQ=HOURLY"
    if schedule_type == "custom_seconds":
        seconds = max(1, int(schedule_value or "60"))
        return f"FREQ=SECONDLY;INTERVAL={seconds}"
    if schedule_type == "daily":
        hour_s, minute_s = (schedule_value or "00:00").split(":")[:2]
        hour = _require_int_range(hour_s, "hour", 0, 23)
        minute = _require_int_range(minute_s, "minute", 0, 59)
        return f"FREQ=DAILY;BYHOUR={hour};BYMINUTE={minute}"
    if schedule_type == "weekly":
        day_s, hour_s, minute_s = (schedule_value or "0:00:00").split(":")[:3]
        day = _require_int_range(day_s, "weekday", 0, 6)
        hour = _require_int_range(hour_s, "hour", 0, 23)
        minute = _require_int_range(minute_s, "minute", 0, 59)
        return f"FREQ=WEEKLY;BYDAY={_PRESET_TO_BYDAY[day]};BYHOUR={hour};BYMINUTE={minute}"
    raise ScheduleValidationError("unknown_preset", f"Unknown schedule_type: {schedule_type}")


def trigger_rrule_to_preset(rule: str | None) -> tuple[str | None, str | None]:
    """Best-effort reverse map for FE preset UI. Unknown shapes → (None, None)."""
    if not rule or not str(rule).strip():
        return None, None
    try:
        parts = parse_rrule_parts(rule)
    except ScheduleValidationError:
        return None, None
    freq = parts["FREQ"].upper()
    interval = int(parts["INTERVAL"]) if "INTERVAL" in parts else 1
    if freq == "SECONDLY":
        if interval == 10 and set(parts) <= {"FREQ", "INTERVAL"}:
            return "seconds_10", None
        return "custom_seconds", str(interval)
    if freq == "HOURLY" and set(parts) <= {"FREQ", "INTERVAL"} and interval == 1:
        return "hourly", None
    if freq == "DAILY" and "BYHOUR" in parts and "BYMINUTE" in parts:
        return "daily", f"{int(parts['BYHOUR']):02d}:{int(parts['BYMINUTE']):02d}"
    if freq == "WEEKLY" and "BYDAY" in parts and "BYHOUR" in parts and "BYMINUTE" in parts:
        day = _BYDAY_TO_PRESET.get(parts["BYDAY"].upper())
        if day is None:
            return None, None
        return "weekly", f"{day}:{int(parts['BYHOUR']):02d}:{int(parts['BYMINUTE']):02d}"
    return None, None


def default_trigger_rrule(analysis_mode: str | None) -> str:
    """Default AI timer when the client omits schedule fields."""
    if analysis_mode == "agent":
        return preset_to_trigger_rrule("hourly", None)
    return preset_to_trigger_rrule("seconds_10", None)


def resolve_trigger_rrule(
    *,
    analysis_mode: str | None,
    schedule_rrule: str | None = None,
    existing_rrule: str | None = None,
) -> str | None:
    """Resolve the persisted trigger RRULE for an AI / recurring shell write.

    Recurring shells store ``NULL`` (calendar series lives on
    ``recurring_schedules``). AI modes always persist a validated trigger RRULE.
    Wire write SoT is ``schedule_rrule`` alone (plus existing / default).
    """
    if analysis_mode == CHILD_RECURRING_MODE:
        return None
    if schedule_rrule is not None and str(schedule_rrule).strip():
        return validate_trigger_rrule(schedule_rrule)
    if existing_rrule is not None and str(existing_rrule).strip():
        return validate_trigger_rrule(existing_rrule)
    return default_trigger_rrule(analysis_mode)


def trigger_from_rrule(rule: str) -> IntervalTrigger | CronTrigger:
    """Build an APScheduler trigger from a trigger-purpose RRULE."""
    parts = parse_rrule_parts(validate_trigger_rrule(rule))
    freq = parts["FREQ"].upper()
    interval = int(parts.get("INTERVAL", "1"))
    if freq == "SECONDLY":
        return IntervalTrigger(seconds=max(1, interval))
    if freq == "MINUTELY":
        return IntervalTrigger(minutes=max(1, interval))
    if freq == "HOURLY":
        return IntervalTrigger(hours=max(1, interval))
    if freq == "DAILY":
        hour = int(parts.get("BYHOUR", "0"))
        minute = int(parts.get("BYMINUTE", "0"))
        return CronTrigger(hour=hour, minute=minute)
    if freq == "WEEKLY":
        day = _BYDAY_TO_PRESET[parts.get("BYDAY", "SU").upper()]
        hour = int(parts.get("BYHOUR", "0"))
        minute = int(parts.get("BYMINUTE", "0"))
        return CronTrigger(day_of_week=_DAY_MAP[day], hour=hour, minute=minute)
    raise ScheduleValidationError("unsupported_freq", f"Unsupported trigger FREQ: {freq}")
