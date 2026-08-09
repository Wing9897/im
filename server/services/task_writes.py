"""Task-write validation shared by ``/api/v1/tasks`` and the calendar agent tools.

Both writers used to carry their own copy of the recurrence rules: the REST
routes validated RRULE but stored it verbatim, while the agent validated and
never checked that the mode allowed a recurrence at all. Everything that
decides *whether* a task write is legal and *what* gets stored now lives here,
so the two callers can only differ in how they report the rejection.
"""

from __future__ import annotations

import re
from typing import Any

from server.calendar.rrule import RruleValidationError, validate_rrule
from server.domain.analysis_modes import (
    AGENT_MODE,
    CHILD_RECURRING_MODE,
)
from server.domain.agent_task_spec import TRIGGER_MESSAGE_CURSOR
from server.time_iso import parse_iso

#: Only ``analysisMode=recurring`` may carry a recurrence; it is never an AI trigger.
RRULE_RECURRING_ONLY_MESSAGE = "RRULE is recurring-only and cannot schedule analysis tasks"

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


def validate_task_recurrence(*, effective_mode: str, supplied_rrule: Any | None) -> str | None:
    """Return the recurrence to store, or raise ``TaskWriteError``.

    ``None`` means the caller supplied no recurrence — for a calendar task that
    clears the rule, and for any other mode it is simply the normal case.
    """
    if effective_mode != CHILD_RECURRING_MODE:
        if supplied_rrule is not None:
            raise TaskWriteError(RRULE_RECURRING_ONLY_MESSAGE)
        return None
    if supplied_rrule is None:
        return None
    return normalize_rrule(supplied_rrule)


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
    """Calendar tasks always appear in time planning; others honor the checkbox.

    ``supplied is None`` keeps ``existing`` on update, or defaults to on for create.
    """
    if effective_mode == CHILD_RECURRING_MODE:
        return 1
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
    existing_cursor = (
        existing_mode == AGENT_MODE and str(existing_trigger or "") == TRIGGER_MESSAGE_CURSOR
    )
    effective_cursor = (
        effective_mode == AGENT_MODE and str(effective_trigger or "") == TRIGGER_MESSAGE_CURSOR
    )
    if existing_cursor and not effective_cursor:
        return True
    if not effective_cursor:
        return False
    if not existing_cursor:
        return True
    if (existing_prompt or "").strip() != (new_prompt or "").strip():
        return True
    return channels_changed


def resolve_parent_task_id(
    *,
    task_id: str | None,
    effective_mode: str,
    supplied_parent_task_id: str | None,
    existing_parent_task_id: str | None = None,
    parent_mode: str | None = None,
) -> str | None:
    """Resolve ``parent_task_id`` for create/update, or raise ``TaskWriteError``.

    Invariants:
    - Only ``recurring`` children may carry a parent; other modes always clear it.
    - Parent must be ``analysis_mode=agent`` when ``parent_mode`` is provided.
    - Self-reference is forbidden.
    """
    if effective_mode != CHILD_RECURRING_MODE:
        return None

    parent = supplied_parent_task_id
    if parent is None:
        parent = existing_parent_task_id
    if parent is None or str(parent).strip() == "":
        return None

    parent_id = str(parent).strip()
    if task_id is not None and parent_id == str(task_id):
        raise TaskWriteError("parent_task_id cannot reference the task itself")
    if parent_mode is not None and parent_mode != AGENT_MODE:
        raise TaskWriteError(f"parent_task_id must reference an agent task (got analysis_mode={parent_mode!r})")
    return parent_id


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
    """Clear ``parent_task_id`` on children when an agent parent leaves agent mode.

    Orphan FK pointers at a non-agent parent are not allowed; clearing the
    link keeps child recurring rows as top-level instead of rejecting the mode change.
    """
    return int(
        await db.execute(
            "UPDATE recurring_schedules SET parent_task_id = NULL, updated_at = ? WHERE parent_task_id = ?",
            (now, parent_task_id),
        )
        or 0
    )
