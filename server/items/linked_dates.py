"""Helpers for linked expiry calendars (``user_events.kind=expires``).

Linked ``kind=expires`` calendars are the write-path source of truth for item
expiry. Item list / card / ``list_expiring`` / remind projection **derive**
``expiresAt`` / ``remindBeforeDays`` on read via
``server.queries.items_queries`` — there is no denormalized item-column cache
and no write-through sync.
"""

from __future__ import annotations

from server.calendar.user_event_kinds import USER_EVENT_KIND_EXPIRES

__all__ = ["is_linked_expiry_kind"]


def is_linked_expiry_kind(kind: str | None) -> bool:
    return str(kind or "").strip() == USER_EVENT_KIND_EXPIRES
