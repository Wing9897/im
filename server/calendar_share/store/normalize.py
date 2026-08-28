"""Handle, slug, and URL normalization for calendar share."""

from __future__ import annotations

import re
from urllib.parse import urlsplit

from server.calendar_share.constants import (
    DEFAULT_BASE_URL,
    DEFAULT_GENERAL_SLUG,
    HANDLE_MAX_LEN,
    INVALID_SLUG_MESSAGE,
    SLUG_MAX_LEN,
)
from server.errors import INVALID_CALENDAR_SLUG, VALIDATION_ERROR, http_error
from server.worksets_const import SYSTEM_WORKSET_ID

_SLUG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
#: Stored / remote slugs may start or end with underscore (pre-fix ``__general__``).
_LEGACY_SLUG_RE = re.compile(r"^[A-Za-z0-9._-]+$")
_HANDLE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


def normalize_base_url(raw: str) -> str:
    text = (raw or "").strip()
    if not text:
        return DEFAULT_BASE_URL
    parsed = urlsplit(text)
    if parsed.scheme not in ("http", "https"):
        raise http_error(422, "Calendar share URL must be http or https", error_code=VALIDATION_ERROR)
    if not parsed.hostname:
        raise http_error(422, "Calendar share URL must include a hostname", error_code=VALIDATION_ERROR)
    if parsed.username or parsed.password:
        raise http_error(422, "Calendar share URL must not include credentials", error_code=VALIDATION_ERROR)
    return text.rstrip("/")


def normalize_handle(raw: str, *, field: str = "handle") -> str:
    text = (raw or "").strip()
    if not text or len(text) > HANDLE_MAX_LEN or not _HANDLE_RE.fullmatch(text):
        raise http_error(
            422,
            f"Invalid {field}: 1–{HANDLE_MAX_LEN} letters, digits, dot, underscore, or hyphen",
            error_code=VALIDATION_ERROR,
        )
    return text


def coerce_publish_slug(raw: str) -> str:
    """Map the builtin workset id to a write-valid default; leave other slugs as-is."""
    text = (raw or "").strip()
    if text == SYSTEM_WORKSET_ID:
        return DEFAULT_GENERAL_SLUG
    return text


def default_publish_slug(workset_title: str, workset_id: str) -> str:
    """Default remote slug for a local workset. ``__general__`` → ``general``."""
    if workset_id.strip() == SYSTEM_WORKSET_ID:
        return DEFAULT_GENERAL_SLUG

    def _candidate(raw: str) -> str:
        cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", raw).strip("._-")
        return cleaned[:SLUG_MAX_LEN]

    from_title = _candidate(workset_title)
    if from_title and _SLUG_RE.fullmatch(from_title):
        return from_title
    from_id = _candidate(workset_id)
    if from_id and _SLUG_RE.fullmatch(from_id):
        return from_id
    return "calendar"


def normalize_slug(raw: str, *, allow_legacy: bool = False) -> str:
    text = (raw or "").strip()
    pattern = _LEGACY_SLUG_RE if allow_legacy else _SLUG_RE
    if not text or len(text) > SLUG_MAX_LEN or not pattern.fullmatch(text):
        raise http_error(
            422,
            INVALID_SLUG_MESSAGE,
            error_code=INVALID_CALENDAR_SLUG,
        )
    return text


def calendar_key(handle: str, slug: str) -> str:
    return f"{handle}/{slug}"


def parse_calendar_path(raw: str) -> tuple[str, str]:
    text = (raw or "").strip().strip("/")
    parts = [p for p in text.split("/") if p]
    if len(parts) != 2:
        raise http_error(422, "Expected handle/slug", error_code=VALIDATION_ERROR)
    return normalize_handle(parts[0]), normalize_slug(parts[1], allow_legacy=True)
