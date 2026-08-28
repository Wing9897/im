"""HTTP client for the public calendar-share server (refresh lives here)."""

from __future__ import annotations

from server.calendar_share.remote_auth import (
    login_remote,
    logout_remote,
    parse_token_pair,
    refresh_remote,
    rotate_access_token,
)
from server.calendar_share.remote_errors import (
    CalendarShareRemoteError,
    _message_from_payload,
    raise_remote_status,
)
from server.calendar_share.remote_http import (
    authorized_request,
    authorized_request_raw,
    calendar_share_request,
)

__all__ = [
    "CalendarShareRemoteError",
    "_message_from_payload",
    "authorized_request",
    "authorized_request_raw",
    "calendar_share_request",
    "login_remote",
    "logout_remote",
    "parse_token_pair",
    "raise_remote_status",
    "refresh_remote",
    "rotate_access_token",
]
