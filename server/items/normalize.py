"""Validation / normalization for item categories and items."""

from __future__ import annotations

import re
from typing import Any

from server.calendar.user_event_kinds import LINKED_EXPIRY_TITLES
from server.worksets_const import SYSTEM_WORKSET_ID

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TITLE_MAX = 200
NOTES_MAX = 4000
NAME_MAX = 120
#: Optional emoji / short logo (grapheme cluster may be multi-codepoint).
EMOJI_MAX = 16
UNIT_MAX = 32
QUANTITY_MAX = 1_000_000_000
SLUG_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")

ALLOWED_STATUSES = frozenset({"active", "archived"})
#: Alias of linked-calendar「到期」/ Expires title presets (kept for callers).
RESERVED_ATTRIBUTE_KEYS = LINKED_EXPIRY_TITLES

_UNSET = object()


class ItemValidationError(ValueError):
    """Invalid item / category fields."""


def parse_date_or_none(value: Any) -> str | None:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    # Accept ISO datetime and keep the calendar date only (DATE semantics).
    if "T" in raw:
        raw = raw[:10]
    if not DATE_RE.match(raw):
        raise ItemValidationError("dates must be YYYY-MM-DD")
    return raw


def require_title(title: str) -> str:
    cleaned = (title or "").strip()
    if not cleaned:
        raise ItemValidationError("title is required")
    if len(cleaned) > TITLE_MAX:
        raise ItemValidationError(f"title must be <= {TITLE_MAX} characters")
    return cleaned


def normalize_notes(notes: Any) -> str:
    text = "" if notes is None else str(notes)
    if len(text) > NOTES_MAX:
        raise ItemValidationError(f"notes must be <= {NOTES_MAX} characters")
    return text


def normalize_status(status: Any) -> str:
    value = (str(status) if status is not None else "active").strip() or "active"
    if value not in ALLOWED_STATUSES:
        raise ItemValidationError("status must be 'active' or 'archived'")
    return value


def normalize_remind_before_days(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        days = int(value)
    except (TypeError, ValueError) as exc:
        raise ItemValidationError("remindBeforeDays must be an integer") from exc
    if days < 0 or days > 3650:
        raise ItemValidationError("remindBeforeDays must be between 0 and 3650")
    return days


def normalize_workset_id_wire(workset_id: Any) -> str:
    if workset_id is None:
        return SYSTEM_WORKSET_ID
    cleaned = str(workset_id).strip()
    if not cleaned or cleaned == SYSTEM_WORKSET_ID:
        return SYSTEM_WORKSET_ID
    return cleaned


def normalize_category_id_wire(category_id: Any) -> str | None:
    if category_id is None:
        return None
    cleaned = str(category_id).strip()
    return cleaned or None


def require_category_name(name: str) -> str:
    cleaned = (name or "").strip()
    if not cleaned:
        raise ItemValidationError("name is required")
    if len(cleaned) > NAME_MAX:
        raise ItemValidationError(f"name must be <= {NAME_MAX} characters")
    return cleaned


def normalize_slug(slug: Any) -> str | None:
    if slug is None:
        return None
    cleaned = str(slug).strip().lower()
    if not cleaned:
        return None
    if not SLUG_RE.match(cleaned):
        raise ItemValidationError("slug must be snake_case alphanumeric")
    return cleaned


def normalize_color(color: Any) -> str | None:
    if color is None:
        return None
    cleaned = str(color).strip()
    return cleaned or None


def normalize_emoji(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    if not cleaned:
        return None
    if len(cleaned) > EMOJI_MAX:
        raise ItemValidationError(f"emoji must be <= {EMOJI_MAX} characters")
    return cleaned


def normalize_quantity(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        num = float(value)
    except (TypeError, ValueError) as exc:
        raise ItemValidationError("quantity must be a number") from exc
    if num < 0:
        raise ItemValidationError("quantity must be >= 0")
    if num > QUANTITY_MAX:
        raise ItemValidationError(f"quantity must be <= {QUANTITY_MAX}")
    return num


def normalize_unit(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    if not cleaned:
        return None
    if len(cleaned) > UNIT_MAX:
        raise ItemValidationError(f"unit must be <= {UNIT_MAX} characters")
    return cleaned


def normalize_sort_order(value: Any) -> int:
    if value is None or value == "":
        return 0
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ItemValidationError("sortOrder must be an integer") from exc
