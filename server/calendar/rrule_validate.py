"""RRULE validation for calendar-purpose (day-grained) series."""

from __future__ import annotations

import re

from dateutil import rrule as du_rrule

from server.domain.rrule_parts import parse_rrule_body_parts

#: Fixed synthetic DTSTART date (not persisted).
ANCHOR_DATE = "20000101"

#: Shared occurrence budget per request across all tasks.
MAX_OCCURRENCES = 1000

#: RRULE components accepted by validate_rrule.
_ALLOWED_COMPONENTS = {"FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "BYMONTH", "UNTIL", "COUNT"}

#: Day-grained frequencies only (UI + product intent). Sub-day FREQ values are rejected on write.
_ALLOWED_FREQS = frozenset({"DAILY", "WEEKLY", "MONTHLY", "YEARLY"})

_UNTIL_Z_RE = re.compile(r"(UNTIL=[0-9T]+)Z", re.IGNORECASE)


def _naive_rule(rule: str) -> str:
    """Strip the Z from UNTIL so the whole rule stays offset-naive (local wall)."""
    return _UNTIL_Z_RE.sub(r"\1", rule)


class RruleValidationError(ValueError):
    """Raised by validate_rrule with a machine-friendly ``code``."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def validate_rrule(rule: str | None) -> None:
    """Validate an RRULE string; raises RruleValidationError on any problem.

    Check order mirrors the reference implementation: empty → unsupported
    component → UNTIL/COUNT conflict → range checks → actual parse.

    Component / FREQ allow-lists are calendar-purpose only (day-grained);
    trigger schedules use a separate whitelist in ``domain.schedule``.
    """
    text = (rule or "").strip()
    parts = parse_rrule_body_parts(
        text,
        error=lambda code, message: RruleValidationError(code, message),
    )
    for key in parts:
        if key not in _ALLOWED_COMPONENTS:
            raise RruleValidationError(
                "unsupported_component",
                f"Unsupported RRULE component: {key}",
            )

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
