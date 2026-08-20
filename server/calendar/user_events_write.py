"""Write side of user-authored timed events (manual UI + assistant tools).

Reads live in ``user_events_read``; field normalization / FK-resolution in
``user_events_normalize``.
"""

from __future__ import annotations

from typing import Any

from server.calendar.user_events_normalize import (
    _UNSET,
    UserEventValidationError,
    UserEventWorksetIdError,
    _normalize_optional_end,
    _normalize_origin,
    _require_nonempty_title,
    _require_start_time,
    apply_finance_for_kind,
    normalize_event_amount,
    normalize_remind_before_days,
    normalize_user_event_kind,
    resolve_user_event_item_id,
    resolve_user_event_task_id,
    resolve_user_event_workset_id,
)
from server.calendar.user_events_read import get_user_event
from server.db.database import Database, TransactionDb
from server.domain.emoji import EmojiValidationError, emoji_from_row, normalize_optional_emoji
from server.domain.notify_prefs import (
    DEFAULT_CALENDAR_NOTIFY_PREF,
    DEFAULT_NOTIFY_PREF,
    normalize_notify_pref,
)
from server.queries.calendar_queries import fetch_user_event
from server.util import new_id, utc_now_iso
from server.worksets_const import SYSTEM_WORKSET_ID

__all__ = [
    "create_user_event",
    "update_user_event",
    "delete_user_event",
]


async def create_user_event(
    db: Database,
    *,
    title: str,
    start_time: str,
    end_time: str | None = None,
    body: str = "",
    location: str = "",
    origin: str = "manual",
    is_all_day: bool = False,
    remind_before_days: Any = None,
    task_id: Any = None,
    item_id: Any = None,
    workset_id: Any = _UNSET,
    kind: Any = None,
    amount: Any = None,
    direction: Any = None,
    notify_pref: Any = None,
    emoji: Any = None,
) -> dict[str, Any]:
    clean_title = _require_nonempty_title(title)
    clean_start = _require_start_time(start_time)
    clean_end = _normalize_optional_end(end_time, clean_start)
    clean_origin = _normalize_origin(origin)
    clean_all_day = bool(is_all_day)
    clean_remind = normalize_remind_before_days(remind_before_days)
    clean_task_id = await resolve_user_event_task_id(db, task_id)
    clean_item_id = await resolve_user_event_item_id(db, item_id)
    clean_kind = normalize_user_event_kind(kind)
    clean_amount = normalize_event_amount(amount)
    clean_amount, clean_direction = apply_finance_for_kind(
        clean_kind,
        amount=clean_amount,
        direction=direction,
    )
    try:
        clean_notify = normalize_notify_pref(notify_pref, default=DEFAULT_CALENDAR_NOTIFY_PREF)
    except ValueError as exc:
        raise UserEventValidationError(str(exc)) from exc
    try:
        clean_emoji = normalize_optional_emoji(emoji)
    except EmojiValidationError as exc:
        raise UserEventValidationError(str(exc)) from exc

    if workset_id is _UNSET:
        # Empty / omitted taskId → system workset; real task → copy task workset if any.
        if clean_task_id is None:
            clean_workset_id = SYSTEM_WORKSET_ID
        else:
            task_row = await db.fetch_one(
                "SELECT workset_id FROM analysis_tasks WHERE id = ?",
                (clean_task_id,),
            )
            raw_ws = task_row.get("workset_id") if task_row else None
            if isinstance(raw_ws, str) and raw_ws.strip():
                clean_workset_id = await resolve_user_event_workset_id(db, raw_ws.strip())
            else:
                clean_workset_id = SYSTEM_WORKSET_ID
    else:
        clean_workset_id = await resolve_user_event_workset_id(db, workset_id)

    event_id = new_id()
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO user_events "
        "(id, title, body, start_time, end_time, location, origin, event_is_all_day, "
        "remind_before_days, task_id, item_id, workset_id, kind, amount, direction, "
        "notify_pref, emoji, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            event_id,
            clean_title,
            (body or "").strip(),
            clean_start,
            clean_end,
            (location or "").strip(),
            clean_origin,
            1 if clean_all_day else 0,
            clean_remind,
            clean_task_id,
            clean_item_id,
            clean_workset_id,
            clean_kind,
            clean_amount,
            clean_direction,
            clean_notify,
            clean_emoji,
            now,
            now,
        ),
    )
    item = await get_user_event(db, event_id)
    assert item is not None
    return item


async def update_user_event(
    db: Database,
    event_id: str,
    *,
    title: Any = _UNSET,
    start_time: Any = _UNSET,
    end_time: Any = _UNSET,
    body: Any = _UNSET,
    location: Any = _UNSET,
    is_all_day: Any = _UNSET,
    remind_before_days: Any = _UNSET,
    task_id: Any = _UNSET,
    item_id: Any = _UNSET,
    workset_id: Any = _UNSET,
    kind: Any = _UNSET,
    amount: Any = _UNSET,
    direction: Any = _UNSET,
    notify_pref: Any = _UNSET,
    emoji: Any = _UNSET,
) -> dict[str, Any] | None:
    """Partial update. Pass ``end_time=None`` (or ``\"\"``) to clear the end."""
    existing = await fetch_user_event(db, event_id)
    if existing is None:
        return None

    raw_prev_iid = existing.get("item_id")
    prev_item_id = str(raw_prev_iid).strip() if isinstance(raw_prev_iid, str) and raw_prev_iid.strip() else None
    prev_kind = normalize_user_event_kind(existing.get("kind"))

    next_title = _require_nonempty_title(str(title)) if title is not _UNSET else str(existing["title"])
    next_start = _require_start_time(str(start_time)) if start_time is not _UNSET else str(existing["start_time"])
    if end_time is _UNSET:
        raw_end = existing.get("end_time")
        next_end = str(raw_end).strip() if isinstance(raw_end, str) and raw_end.strip() else None
    else:
        next_end = _normalize_optional_end(
            None if end_time is None else str(end_time),
            next_start,
        )
    if next_end is not None:
        next_end = _normalize_optional_end(next_end, next_start)

    next_body = str(existing.get("body") or "") if body is _UNSET else str(body or "").strip()
    next_location = str(existing.get("location") or "") if location is _UNSET else str(location or "").strip()
    next_all_day = bool(existing.get("event_is_all_day")) if is_all_day is _UNSET else bool(is_all_day)
    if remind_before_days is _UNSET:
        raw_remind = existing.get("remind_before_days")
        next_remind = int(raw_remind) if raw_remind is not None else None
    else:
        next_remind = normalize_remind_before_days(remind_before_days)
    if task_id is _UNSET:
        raw_tid = existing.get("task_id")
        next_task_id = str(raw_tid).strip() if isinstance(raw_tid, str) and raw_tid.strip() else None
    else:
        next_task_id = await resolve_user_event_task_id(db, task_id)
    if item_id is _UNSET:
        next_item_id = prev_item_id
    else:
        next_item_id = await resolve_user_event_item_id(db, item_id)

    if workset_id is _UNSET:
        raw_wid = existing.get("workset_id")
        next_workset_id = str(raw_wid).strip() if isinstance(raw_wid, str) and raw_wid.strip() else SYSTEM_WORKSET_ID
        # Ensure FK still resolves (deleted workset → system).
        try:
            next_workset_id = await resolve_user_event_workset_id(db, next_workset_id)
        except UserEventWorksetIdError:
            next_workset_id = SYSTEM_WORKSET_ID
    else:
        next_workset_id = await resolve_user_event_workset_id(db, workset_id)

    next_kind = normalize_user_event_kind(kind) if kind is not _UNSET else prev_kind

    if amount is _UNSET:
        raw_amount = existing.get("amount")
        next_amount = float(raw_amount) if raw_amount is not None else None
    else:
        next_amount = normalize_event_amount(amount)
    if direction is _UNSET:
        raw_direction = existing.get("direction")
        direction_arg: Any = (
            str(raw_direction).strip() if isinstance(raw_direction, str) and str(raw_direction).strip() else None
        )
    else:
        direction_arg = direction
    next_amount, next_direction = apply_finance_for_kind(
        next_kind,
        amount=next_amount,
        direction=direction_arg,
    )
    if notify_pref is _UNSET:
        raw_notify = existing.get("notify_pref")
        next_notify = raw_notify.strip() if isinstance(raw_notify, str) and raw_notify.strip() else DEFAULT_NOTIFY_PREF
        try:
            next_notify = normalize_notify_pref(next_notify)
        except ValueError:
            next_notify = DEFAULT_NOTIFY_PREF
    else:
        try:
            next_notify = normalize_notify_pref(notify_pref)
        except ValueError as exc:
            raise UserEventValidationError(str(exc)) from exc
    if emoji is _UNSET:
        next_emoji = emoji_from_row(existing)
    else:
        try:
            next_emoji = normalize_optional_emoji(emoji)
        except EmojiValidationError as exc:
            raise UserEventValidationError(str(exc)) from exc

    await db.execute(
        "UPDATE user_events SET title = ?, body = ?, start_time = ?, end_time = ?, "
        "location = ?, event_is_all_day = ?, remind_before_days = ?, task_id = ?, item_id = ?, "
        "workset_id = ?, kind = ?, amount = ?, direction = ?, notify_pref = ?, emoji = ?, updated_at = ? "
        "WHERE id = ?",
        (
            next_title,
            next_body,
            next_start,
            next_end,
            next_location,
            1 if next_all_day else 0,
            next_remind,
            next_task_id,
            next_item_id,
            next_workset_id,
            next_kind,
            next_amount,
            next_direction,
            next_notify,
            next_emoji,
            utc_now_iso(),
            event_id,
        ),
    )
    item = await get_user_event(db, event_id)
    assert item is not None
    return item


async def delete_user_event(db: Database, event_id: str) -> bool:
    """Hard-delete a user event (Schedule / Items trash).

    Timeline hide/restore stays on ``PUT/DELETE /calendar/dismissals``. Agent
    ``calendar.delete_event`` also stays a soft-dismiss and does not call this.
    """
    existing = await fetch_user_event(db, event_id)
    if existing is None:
        return False
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await tx.execute(
            "DELETE FROM timeline_dismissals WHERE source = 'user' AND event_id = ?",
            (event_id,),
        )
        await tx.execute(
            "DELETE FROM timeline_importance WHERE source = 'user' AND event_id = ?",
            (event_id,),
        )
        await tx.execute("DELETE FROM user_events WHERE id = ?", (event_id,))
    return True
