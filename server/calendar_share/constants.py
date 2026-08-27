"""Config keys and visibility literals for calendar share."""

from __future__ import annotations

from typing import Final, Literal

DEFAULT_BASE_URL: Final = "http://127.0.0.1:8787"

KEY_BASE_URL: Final = "calendar_share_base_url"
KEY_HANDLE: Final = "calendar_share_handle"
KEY_ACCESS_TOKEN: Final = "calendar_share_access_token"
KEY_REFRESH_TOKEN: Final = "calendar_share_refresh_token"
KEY_WORKSETS: Final = "calendar_share_worksets"
KEY_TIMEZONE: Final = "calendar_share_timezone"
KEY_TIMEZONE_PENDING: Final = "calendar_share_timezone_pending"
KEY_TIMEZONE_LAST_PUBLIC: Final = "calendar_share_timezone_last_public"

PublicVisibility = Literal["off", "busy", "details"]
GrantVisibility = Literal["busy", "details"]

VISIBILITY_PUBLIC: Final[tuple[PublicVisibility, ...]] = ("off", "busy", "details")
VISIBILITY_GRANT: Final[tuple[GrantVisibility, ...]] = ("busy", "details")

SLUG_MAX_LEN: Final = 64
HANDLE_MAX_LEN: Final = 64
