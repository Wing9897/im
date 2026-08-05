"""Device sessions: opaque access/refresh tokens bound to the household.

Tokens are random opaque strings; only SHA-256 hashes are stored. Verification
uses ``secrets.compare_digest``. Access TTL 1h; refresh TTL 90d.

Public façade — token issuance in ``device_token_issue``, session verify/list
in ``device_session_ops``.
"""

from __future__ import annotations

from server.auth.device_session_ops import (
    count_active_device_sessions,
    credentials_configured,
    has_active_device_session,
    is_bootstrapped,
    list_devices,
    mark_household_secured,
    maybe_touch_session,
    resolve_session_id_for_access_token,
    revoke_session,
    revoke_session_for_access_token,
    touch_session,
)
from server.auth.device_token_issue import (
    ACCESS_TTL,
    REFRESH_TTL,
    create_device_session,
    refresh_device_session,
)
from server.util import new_id, utc_now_iso

__all__ = [
    "ACCESS_TTL",
    "REFRESH_TTL",
    "count_active_device_sessions",
    "create_device_session",
    "credentials_configured",
    "has_active_device_session",
    "is_bootstrapped",
    "list_devices",
    "mark_household_secured",
    "maybe_touch_session",
    "new_id",
    "refresh_device_session",
    "resolve_session_id_for_access_token",
    "revoke_session",
    "revoke_session_for_access_token",
    "touch_session",
    "utc_now_iso",
]
