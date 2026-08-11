"""Task-write validation shared by ``/api/v1/tasks`` and related writers.

Calendar RRULE series live on ``recurring_schedules`` and are validated via
``normalize_rrule`` / series writers — not via analysis-task mode.
"""

from __future__ import annotations

import re
from typing import Any

from server.calendar.rrule import RruleValidationError, validate_rrule
from server.domain.agent_task_spec import TRIGGER_MESSAGE_CURSOR
from server.domain.analysis_modes import AGENT_MODE
from server.time_iso import parse_iso

#: Calendar RRULE must not be written onto analysis tasks.
RRULE_RECURRING_ONLY_MESSAGE = "RRULE calendar series use POST /calendar/recurring; analysis tasks use scheduleRrule only"

_RRULE_PREFIX = "RRULE:"
_CLOCK_RE = re.compile(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$")


class TaskWriteError(ValueError):
    """A task write rejected before any row was touched."""


def normalize_rrule(rrule_raw: Any) -> str:
    """Validate a recurrence and canonicalize it for storage.

    Writers must send the RFC 5545 body without an ``RRULE:`` prefix; the stored
    form keeps that spelling so expansion and equality checks stay unambiguous.
    """
    text = "" if rrule_raw is None else str(rrule_raw).strip()
    if text.upper().startswith(_RRULE_PREFIX):
        raise TaskWriteError("RRULE must not include an 'RRULE:' prefix")
    try:
        validate_rrule(text)
    except RruleValidationError as exc:
        raise TaskWriteError(f"Invalid RRULE ({exc.code}): {exc}") from exc
    return text


def normalize_event_clock(value: Any) -> str | None:
    """Normalize a calendar clock to ``HH:MM``, or ``None`` when empty/invalid.

    Accepts the task-form ``HH:MM`` spelling and a full ISO timestamp, whose
    wall-clock time is taken as-is (calendar clocks are system-local).
    """
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    match = _CLOCK_RE.fullmatch(text)
    if match:
        hour, minute = int(match.group(1)), int(match.group(2))
        return f"{hour:02d}:{minute:02d}" if hour < 24 and minute < 60 else None
    parsed = parse_iso(text)
    if parsed is None:
        return None
    local = parsed.timetz().replace(tzinfo=None)
    return f"{local.hour:02d}:{local.minute:02d}"


def resolve_include_in_timeline(
    *,
    effective_mode: str,
    supplied: bool | None,
    existing: bool | int | None = None,
) -> int:
    """Honor the checkbox; default on for create when unset."""
    del effective_mode
    if supplied is not None:
        return 1 if supplied else 0
    if existing is not None:
        return 1 if bool(existing) else 0
    return 1


def should_reset_agent_message_cursor(
    *,
    existing_mode: str,
    effective_mode: str,
    existing_prompt: str | None,
    new_prompt: str | None,
    channels_changed: bool,
    existing_trigger: str | None = None,
    effective_trigger: str | None = None,
) -> bool:
    """Whether a task update should wipe ``agent_message_cursors``.

    Soft policy: keep progress for rename / schedule / description-only edits.
    Reset when leaving message_cursor drain, changing goals (prompt), or rebinding sources.
    """
    existing_cursor = existing_mode == AGENT_MODE and str(existing_trigger or "") == TRIGGER_MESSAGE_CURSOR
    effective_cursor = effective_mode == AGENT_MODE and str(effective_trigger or "") == TRIGGER_MESSAGE_CURSOR
    if existing_cursor and not effective_cursor:
        return True
    if not effective_cursor:
        return False
    if not existing_cursor:
        return True
    if (existing_prompt or "").strip() != (new_prompt or "").strip():
        return True
    return channels_changed


def resolve_series_parent_task_id(
    *,
    series_id: str | None,
    supplied_parent_task_id: str | None,
    existing_parent_task_id: str | None = None,
    parent_mode: str | None = None,
) -> str | None:
    """Resolve ``parent_task_id`` for a recurring series, or raise ``TaskWriteError``.

    Invariants:
    - Parent must be ``analysis_mode=agent`` when ``parent_mode`` is provided.
    - Self-reference is forbidden (series id ≠ parent task id).
    """
    parent = supplied_parent_task_id
    if parent is None:
        parent = existing_parent_task_id
    if parent is None or str(parent).strip() == "":
        return None

    parent_id = str(parent).strip()
    if series_id is not None and parent_id == str(series_id):
        raise TaskWriteError("parent_task_id cannot reference the series itself")
    if parent_mode is not None and parent_mode != AGENT_MODE:
        raise TaskWriteError(f"parent_task_id must reference an agent task (got analysis_mode={parent_mode!r})")
    return parent_id


def resolve_parent_task_id(
    *,
    task_id: str | None,
    effective_mode: str,
    supplied_parent_task_id: str | None,
    existing_parent_task_id: str | None = None,
    parent_mode: str | None = None,
) -> str | None:
    """Analysis tasks never carry ``parent_task_id`` (series-only relation)."""
    del task_id, effective_mode, supplied_parent_task_id, existing_parent_task_id, parent_mode
    return None


async def assert_parent_agent_row(db: Any, parent_task_id: str) -> str:
    """Load parent row and ensure it is ``agent`` mode; return its id."""
    row = await db.fetch_one(
        "SELECT id, analysis_mode FROM analysis_tasks WHERE id = ?",
        (parent_task_id,),
    )
    if row is None:
        raise TaskWriteError(f"parent_task_id not found: {parent_task_id}")
    mode = str(row.get("analysis_mode") or "")
    if mode != AGENT_MODE:
        raise TaskWriteError(f"parent_task_id must reference an agent task (got analysis_mode={mode!r})")
    return str(row["id"])


async def clear_children_parent_links(db: Any, parent_task_id: str, *, now: str) -> int:
    """Clear ``parent_task_id`` on child series when an agent parent leaves agent mode."""
    return int(
        await db.execute(
            "UPDATE recurring_schedules SET parent_task_id = NULL, updated_at = ? WHERE parent_task_id = ?",
            (now, parent_task_id),
        )
        or 0
    )
