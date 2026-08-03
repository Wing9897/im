"""Shared RRULE body tokenization (no purpose whitelist).

Trigger schedules (``domain.schedule``) and calendar series (``calendar.rrule``)
share syntax tokenization but keep **separate** component / FREQ allow-lists —
product rules differ (sub-day trigger FREQ vs day-grained calendar FREQ).
"""

from __future__ import annotations

import re
from collections.abc import Callable

_PART_RE = re.compile(r"([A-Z]+)=([^;]*)", re.IGNORECASE)

#: ``(code, message) -> BaseException`` factory used by purpose-specific validators.
RrulePartsErrorFactory = Callable[[str, str], BaseException]


def parse_rrule_body_parts(
    rule: str | None,
    *,
    error: RrulePartsErrorFactory,
    require_freq: bool = True,
) -> dict[str, str]:
    """Parse ``FREQ=…;INTERVAL=…`` body into upper-cased component map.

    Structural checks only (empty / ``RRULE:`` prefix / malformed chunks).
    Callers enforce their own component and FREQ allow-lists.
    """
    text = (rule or "").strip()
    if not text:
        raise error("empty", "RRULE is empty")
    if text.upper().startswith("RRULE:"):
        raise error(
            "rrule_prefix",
            "RRULE must not include an 'RRULE:' prefix",
        )

    parts: dict[str, str] = {}
    for chunk in text.split(";"):
        if not chunk:
            continue
        match = _PART_RE.fullmatch(chunk.strip())
        if match is None:
            raise error("malformed", f"Malformed RRULE component: {chunk}")
        parts[match.group(1).upper()] = match.group(2).strip()

    if require_freq and "FREQ" not in parts:
        raise error("missing_freq", "RRULE must include FREQ")
    return parts


__all__ = ["RrulePartsErrorFactory", "parse_rrule_body_parts"]
