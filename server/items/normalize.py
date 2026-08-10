"""Validation / normalization for item categories and items."""

from __future__ import annotations

import json
import re
from typing import Any

from server.worksets_const import SYSTEM_WORKSET_ID

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
#: Soft attribute value max length (chars).
ATTR_VALUE_MAX = 500
#: Whole attributes_json max serialized size (bytes, utf-8).
ATTR_JSON_MAX_BYTES = 8 * 1024
#: Max number of attribute keys (aligned with field schema soft cap).
ATTR_MAX_KEYS = 40
FIELD_SCHEMA_MAX_KEYS = 40
TITLE_MAX = 200
NOTES_MAX = 4000
NAME_MAX = 120
#: Optional emoji / short logo (grapheme cluster may be multi-codepoint).
EMOJI_MAX = 16
UNIT_MAX = 32
QUANTITY_MAX = 1_000_000_000
PRICE_MAX = 1_000_000_000_000
SLUG_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")

ALLOWED_STATUSES = frozenset({"active", "archived"})
#: Reserved for linked-calendar「到期」/ Expires quick option (not free attributes).
RESERVED_ATTRIBUTE_KEYS = frozenset({"到期", "Expires"})
_SCALAR_ATTR_TYPES = (str, int, float, bool)

_UNSET = object()


class ItemValidationError(ValueError):
    """Invalid item / category fields."""


def _assert_not_reserved_attribute_key(key: str) -> None:
    if key in RESERVED_ATTRIBUTE_KEYS:
        raise ItemValidationError("attribute key is reserved for linked-calendar expiry; use 关联日历 → 到期")


def _coerce_attr_scalar(value: Any) -> str | None:
    """Accept only single scalar values; reject nested structures that amplify on str()."""
    if value is None:
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        return value
    raise ItemValidationError("attribute values must be single scalars (string/number/boolean)")


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


def normalize_attributes(attributes: Any) -> dict[str, str]:
    if attributes is None:
        return {}
    if isinstance(attributes, str):
        raw = attributes.strip()
        if not raw:
            return {}
        try:
            attributes = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ItemValidationError("attributes must be a JSON object") from exc
    if not isinstance(attributes, dict):
        raise ItemValidationError("attributes must be an object")
    out: dict[str, str] = {}
    for key, value in attributes.items():
        k = str(key).strip()
        if not k:
            continue
        _assert_not_reserved_attribute_key(k)
        if len(k) > 64:
            raise ItemValidationError("attribute keys must be <= 64 characters")
        text = _coerce_attr_scalar(value)
        if text is None:
            continue
        if len(text) > ATTR_VALUE_MAX:
            raise ItemValidationError(f"attribute values must be <= {ATTR_VALUE_MAX} characters")
        out[k] = text
        if len(out) > ATTR_MAX_KEYS:
            raise ItemValidationError(f"attributes must have <= {ATTR_MAX_KEYS} keys")
    encoded = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    if len(encoded.encode("utf-8")) > ATTR_JSON_MAX_BYTES:
        raise ItemValidationError(f"attributes must be <= {ATTR_JSON_MAX_BYTES} bytes")
    return out


def attributes_to_json(attributes: dict[str, str]) -> str:
    return json.dumps(attributes, ensure_ascii=False, separators=(",", ":"))


def preserve_attributes_json(raw: Any) -> str:
    """Keep stored attributes_json bytes as-is on unrelated PATCHes (no re-amplify)."""
    if raw is None:
        return "{}"
    if isinstance(raw, dict):
        return attributes_to_json(normalize_attributes(raw))
    text = str(raw).strip()
    return text if text else "{}"


def parse_attributes_json(raw: Any) -> dict[str, str]:
    """Read path: soft-sanitize dirty rows (drop nested / oversize) without raising."""
    if raw is None or raw == "":
        return {}
    if isinstance(raw, dict):
        parsed: Any = raw
    else:
        try:
            parsed = json.loads(str(raw))
        except json.JSONDecodeError:
            return {}
    if not isinstance(parsed, dict):
        return {}
    out: dict[str, str] = {}
    for key, value in parsed.items():
        k = str(key).strip()
        if not k or len(k) > 64 or k in RESERVED_ATTRIBUTE_KEYS:
            continue
        if value is None or isinstance(value, (dict, list)):
            continue
        if not isinstance(value, _SCALAR_ATTR_TYPES):
            continue
        try:
            text = _coerce_attr_scalar(value)
        except ItemValidationError:
            continue
        if text is None or len(text) > ATTR_VALUE_MAX:
            continue
        candidate = {**out, k: text}
        encoded = json.dumps(candidate, ensure_ascii=False, separators=(",", ":"))
        if len(encoded.encode("utf-8")) > ATTR_JSON_MAX_BYTES:
            break
        out = candidate
        if len(out) >= ATTR_MAX_KEYS:
            break
    return out


def normalize_field_schema(value: Any) -> list[dict[str, str]]:
    if value is None or value == "":
        return []
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise ItemValidationError("fieldSchema must be a JSON array") from exc
    if not isinstance(value, list):
        raise ItemValidationError("fieldSchema must be an array")
    if len(value) > FIELD_SCHEMA_MAX_KEYS:
        raise ItemValidationError(f"fieldSchema must have <= {FIELD_SCHEMA_MAX_KEYS} keys")
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for entry in value:
        if not isinstance(entry, dict):
            raise ItemValidationError("fieldSchema entries must be objects")
        key = str(entry.get("key") or "").strip()
        label = str(entry.get("label") or key).strip()
        if not key:
            raise ItemValidationError("fieldSchema key is required")
        _assert_not_reserved_attribute_key(key)
        if len(key) > 64 or len(label) > 120:
            raise ItemValidationError("fieldSchema key/label too long")
        if key in seen:
            continue
        seen.add(key)
        out.append({"key": key, "label": label or key})
    return out


def seed_attributes_from_field_schema(
    attributes: dict[str, str],
    field_schema: list[dict[str, str]] | None,
) -> dict[str, str]:
    """Copy-on-create: fill missing category preset keys with empty string values.

    Existing keys (including empty strings) are never overwritten. Do **not** call
    this when a category template changes — existing items keep their own
    attributes_json unchanged (no live inheritance / rewrite).
    """
    out = dict(attributes)
    for entry in field_schema or []:
        if len(out) >= ATTR_MAX_KEYS:
            break
        key = str(entry.get("key") or "").strip()
        if not key or key in out or key in RESERVED_ATTRIBUTE_KEYS:
            continue
        if len(key) > 64:
            continue
        out[key] = ""
    return out


def field_schema_to_json(schema: list[dict[str, str]]) -> str:
    return json.dumps(schema, ensure_ascii=False, separators=(",", ":"))


def parse_field_schema_json(raw: Any) -> list[dict[str, str]]:
    try:
        return normalize_field_schema(raw)
    except ItemValidationError:
        return []


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


def normalize_price(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        num = float(value)
    except (TypeError, ValueError) as exc:
        raise ItemValidationError("price must be a number") from exc
    if num < 0:
        raise ItemValidationError("price must be >= 0")
    if num > PRICE_MAX:
        raise ItemValidationError(f"price must be <= {PRICE_MAX}")
    # Store with at most two decimal places (money semantics).
    return round(num, 2)


def normalize_sort_order(value: Any) -> int:
    if value is None or value == "":
        return 0
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ItemValidationError("sortOrder must be an integer") from exc
