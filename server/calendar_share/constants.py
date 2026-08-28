"""Config keys and visibility literals for calendar share."""

from __future__ import annotations

from typing import Final, Literal

DEFAULT_BASE_URL: Final = "http://127.0.0.1:8787"

KEY_BASE_URL: Final = "calendar_share_base_url"
KEY_HANDLE: Final = "calendar_share_handle"
KEY_ACCESS_TOKEN: Final = "calendar_share_access_token"
KEY_REFRESH_TOKEN: Final = "calendar_share_refresh_token"
KEY_TIMEZONE: Final = "calendar_share_timezone"
KEY_TIMEZONE_PENDING: Final = "calendar_share_timezone_pending"
KEY_TIMEZONE_LAST_PUBLIC: Final = "calendar_share_timezone_last_public"

LISTING_PRIVATE_GROUP: Final = "private_group"
LISTING_PUBLIC: Final = "public"
LISTING_PUBLIC_BUSY: Final = "public_busy"

PublicVisibility = Literal["private_group", "public", "public_busy"]
GrantVisibility = Literal["busy", "details"]
#: Search listing hits vs grant hits are distinguished by ``hitKind``.
SearchHitKind = Literal["listing", "grant"]
SearchHitVisibility = Literal["public", "public_busy", "busy", "details"]

VISIBILITY_PUBLIC: Final[tuple[PublicVisibility, ...]] = (
    LISTING_PRIVATE_GROUP,
    LISTING_PUBLIC,
    LISTING_PUBLIC_BUSY,
)
VISIBILITY_GRANT: Final[tuple[GrantVisibility, ...]] = ("busy", "details")
VISIBILITY_SEARCH_HIT: Final[tuple[str, ...]] = ("public", "public_busy", "busy", "details")

SLUG_MAX_LEN: Final = 64
HANDLE_MAX_LEN: Final = 64
#: Builtin workset id ``__general__`` is not a valid write slug (leading ``_``).
DEFAULT_GENERAL_SLUG: Final = "general"
INVALID_SLUG_MESSAGE: Final = (
    f"Invalid slug: 1–{SLUG_MAX_LEN} characters; start with a letter or digit; "
    "then letters, digits, dot, underscore, or hyphen"
)


def canonicalize_listing_visibility(
    value: object,
    *,
    default: PublicVisibility = LISTING_PRIVATE_GROUP,
) -> PublicVisibility:
    """Accept canonical listing strings only; unknown → ``private_group``."""
    if not isinstance(value, str):
        return default
    text = value.strip()
    if text in VISIBILITY_PUBLIC:
        return text  # type: ignore[return-value]
    return default


def try_canonicalize_listing_visibility(value: object) -> PublicVisibility | None:
    """Return a canonical listing string, or None when empty or unknown."""
    if not isinstance(value, str):
        return None
    text = value.strip()
    if text in VISIBILITY_PUBLIC:
        return text  # type: ignore[return-value]
    return None
