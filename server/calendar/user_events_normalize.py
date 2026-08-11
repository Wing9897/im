"""Field normalization / FK-resolution helpers for user_events (split from ``user_events.py``).

Kept separate from CRUD so the wire-shape validation rules (title/time/origin,
``taskId``/``worksetId`` sentinels) can be read and tested independently of the
database read/write paths.
"""

from __future__ import annotations

from typing import Any

from server.calendar.user_event_kinds import (
    finance_allowed_for_kind,
)
from server.calendar.user_event_kinds import (
    normalize_user_event_kind as _normalize_kind_value,
)
from server.db.database import Database
from server.domain.analysis_modes import TIMELINE_OWNING_ANALYSIS_MODES
from server.time_iso import parse_iso, to_iso_z
from server.worksets_const import SYSTEM_WORKSET_ID

ALLOWED_ORIGINS = frozenset({"manual", "assistant", "a2a", "agent", "ics"})
#: Tasks that may own a user_event (filter / timeline attribution).
USER_EVENT_TASK_MODES = TIMELINE_OWNING_ANALYSIS_MODES
ALLOWED_EVENT_DIRECTIONS = frozenset({"expense", "income"})
AMOUNT_MAX = 1_000_000_000_000

# Sentinel: field not provided in a partial update.
_UNSET = object()


class UserEventValidationError(ValueError):
    """Invalid user-event fields."""


def normalize_user_event_kind(value: Any) -> str:
    """``normal`` | ``expires`` | ``purchase_effective``; blank → ``normal``."""
    try:
        return _normalize_kind_value(value)
    except ValueError as exc:
        raise UserEventValidationError(str(exc)) from exc


def normalize_event_amount(value: Any) -> float | None:
    """Optional transaction amount (money); null clears finance fields."""
    if value is None or value == "":
        return None
    try:
        num = float(value)
    except (TypeError, ValueError) as exc:
        raise UserEventValidationError("amount must be a number") from exc
    if num < 0:
        raise UserEventValidationError("amount must be >= 0")
    if num > AMOUNT_MAX:
        raise UserEventValidationError(f"amount must be <= {AMOUNT_MAX}")
    return round(num, 2)


def normalize_event_direction(value: Any, *, amount: float | None) -> str | None:
    """``expense`` | ``income``; cleared when amount is null; defaults to expense."""
    if amount is None:
        return None
    if value is None or value == "":
        return "expense"
    cleaned = str(value).strip().lower()
    if cleaned not in ALLOWED_EVENT_DIRECTIONS:
        raise UserEventValidationError("direction must be 'expense' or 'income'")
    return cleaned


def apply_finance_for_kind(
    kind: str,
    *,
    amount: float | None,
    direction: Any,
) -> tuple[float | None, str | None]:
    """Keep amount/direction only for ``purchase_effective``; otherwise clear."""
    if not finance_allowed_for_kind(kind):
        return None, None
    clean_amount = amount
    return clean_amount, normalize_event_direction(direction, amount=clean_amount)


class UserEventTaskIdError(UserEventValidationError):
    """Invalid or disallowed ``taskId`` (HTTP 400 at the route boundary)."""


class UserEventWorksetIdError(UserEventValidationError):
    """Invalid or unknown ``worksetId`` (HTTP 400 at the route boundary)."""


class UserEventItemIdError(UserEventValidationError):
    """Invalid or unknown ``itemId`` (HTTP 400 at the route boundary)."""


def _require_nonempty_title(title: str) -> str:
    cleaned = (title or "").strip()
    if not cleaned:
        raise UserEventValidationError("title is required")
    return cleaned


def _require_start_time(start_time: str) -> str:
    raw = (start_time or "").strip()
    if not raw:
        raise UserEventValidationError("startTime is required")
    parsed = parse_iso(raw)
    if parsed is None:
        raise UserEventValidationError("startTime must be a valid ISO-8601 datetime")
    # Store canonical UTC Z so list windows and UI calendars compare reliably.
    return to_iso_z(parsed)


def _normalize_optional_end(end_time: str | None, start_time: str) -> str | None:
    if end_time is None:
        return None
    raw = str(end_time).strip()
    if not raw:
        return None
    parsed_end = parse_iso(raw)
    if parsed_end is None:
        raise UserEventValidationError("endTime must be a valid ISO-8601 datetime")
    parsed_start = parse_iso(start_time)
    if parsed_start is not None and parsed_end < parsed_start:
        raise UserEventValidationError("endTime must be >= startTime")
    return to_iso_z(parsed_end)


def _normalize_origin(origin: str) -> str:
    value = (origin or "").strip()
    if value not in ALLOWED_ORIGINS:
        raise UserEventValidationError("origin must be 'manual', 'assistant', 'a2a', 'agent', or 'ics'")
    return value


def normalize_user_event_task_id_wire(task_id: Any) -> str | None | object:
    """Map wire ``taskId`` to DB value or ``_UNSET`` when omitted.

    ``None`` / ``""`` → store NULL (optional provenance only).
    ``__user__`` is rejected — ownership uses ``worksetId``, not taskId.
    """
    if task_id is _UNSET:
        return _UNSET
    if task_id is None:
        return None
    cleaned = str(task_id).strip()
    if not cleaned:
        return None
    if cleaned == SYSTEM_WORKSET_ID:
        raise UserEventTaskIdError("taskId must not be '__user__'; use worksetId for ownership")
    return cleaned


def normalize_user_event_workset_id_wire(workset_id: Any) -> str | None | object:
    """Map wire ``worksetId`` to a stored FK or ``_UNSET`` when omitted.

    ``None`` / ``""`` / ``__user__`` → builtin system workset id.
    """
    if workset_id is _UNSET:
        return _UNSET
    if workset_id is None:
        return SYSTEM_WORKSET_ID
    cleaned = str(workset_id).strip()
    if not cleaned or cleaned == SYSTEM_WORKSET_ID:
        return SYSTEM_WORKSET_ID
    return cleaned


async def resolve_user_event_task_id(db: Database, task_id: Any) -> str | None:
    """Resolve wire taskId to a stored FK value (NULL = no analysis-task provenance)."""
    normalized = normalize_user_event_task_id_wire(task_id)
    if normalized is None:
        return None
    assert isinstance(normalized, str)
    row = await db.fetch_one(
        "SELECT id, analysis_mode FROM analysis_tasks WHERE id = ?",
        (normalized,),
    )
    if row is None:
        raise UserEventTaskIdError("taskId does not refer to an existing task")
    mode = str(row.get("analysis_mode") or "")
    if mode not in USER_EVENT_TASK_MODES:
        raise UserEventTaskIdError("taskId must refer to an event, recurring, or project task")
    return normalized


async def resolve_user_event_workset_id(db: Database, workset_id: Any) -> str:
    """Resolve wire worksetId to a stored FK (defaults to builtin ``__user__``)."""
    normalized = normalize_user_event_workset_id_wire(workset_id)
    assert isinstance(normalized, str)
    row = await db.fetch_one("SELECT id FROM worksets WHERE id = ?", (normalized,))
    if row is None:
        raise UserEventWorksetIdError("worksetId does not refer to an existing workset")
    return normalized


def normalize_remind_before_days(value: Any) -> int | None:
    """Optional non-negative day offset; blank / null clears."""
    if value is None or value is _UNSET:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    try:
        days = int(value)
    except (TypeError, ValueError) as exc:
        raise UserEventValidationError("remindBeforeDays must be an integer") from exc
    if days < 0:
        raise UserEventValidationError("remindBeforeDays must be >= 0")
    if days > 3660:
        raise UserEventValidationError("remindBeforeDays must be <= 3660")
    return days


async def resolve_user_event_item_id(db: Database, item_id: Any) -> str | None:
    """Resolve optional parent item id (NULL = stand-alone calendar event)."""
    if item_id is None or item_id is _UNSET:
        return None
    cleaned = str(item_id).strip()
    if not cleaned:
        return None
    row = await db.fetch_one("SELECT id FROM items WHERE id = ?", (cleaned,))
    if row is None:
        raise UserEventItemIdError("itemId does not refer to an existing item")
    return cleaned


def build_user_event_list_filters(
    *,
    start: str | None = None,
    end: str | None = None,
    task_id: str | None = None,
    workset_id: str | None = None,
    item_id: str | None = None,
    search: str | None = None,
) -> tuple[list[str], list[Any]]:
    """Build SQL WHERE clauses for ``list_user_events``.

    ``task_id``:
    - omitted / ``None``: no provenance filter
    - ``""``: only rows with ``task_id IS NULL``
    - ``__user__``: rejected (ownership filter is ``workset_id``)
    - real id: ``task_id = ?``

    ``workset_id``:
    - omitted / ``None`` / empty: no ownership filter
    - real id (incl. ``__user__``): ``workset_id = ?``

    ``search``:
    - omitted / blank: no text filter
    - non-empty: case-insensitive substring on title / body / location
    """
    clauses: list[str] = []
    params: list[Any] = []
    if start and start.strip():
        clauses.append("julianday(COALESCE(NULLIF(end_time, ''), start_time)) >= julianday(?)")
        params.append(start.strip())
    if end and end.strip():
        clauses.append("julianday(start_time) <= julianday(?)")
        params.append(end.strip())
    if task_id is not None:
        tid = str(task_id).strip()
        if tid == SYSTEM_WORKSET_ID:
            raise UserEventTaskIdError("task_id must not be '__user__'; use workset_id for ownership filter")
        if not tid:
            clauses.append("task_id IS NULL")
        else:
            clauses.append("task_id = ?")
            params.append(tid)
    if workset_id is not None:
        wid = str(workset_id).strip()
        if wid:
            clauses.append("workset_id = ?")
            params.append(wid)
    if item_id is not None:
        iid = str(item_id).strip()
        if iid:
            clauses.append("item_id = ?")
            params.append(iid)
        else:
            clauses.append("item_id IS NULL")
    if search is not None:
        needle = str(search).strip()
        if needle:
            like = f"%{needle}%"
            clauses.append("(title LIKE ? OR body LIKE ? OR location LIKE ?)")
            params.extend([like, like, like])
    return clauses, params
