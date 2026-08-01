"""A2A route auth: full household access key required (no device session)."""

from __future__ import annotations

from fastapi import Request

from server.auth.access_keys import (
    resolve_access_token,
    scopes_allow_full,
    touch_access_key_last_used,
)
from server.api.deps import get_db
from server.auth import presented_token
from server.errors import FORBIDDEN, http_error


async def require_household_access_key(request: Request) -> dict[str, object]:
    """Require a valid household access key Bearer (reject device sessions).

    Loopback exemption does **not** apply — external agents must present a key.
    """
    db = get_db(request)
    token = presented_token(request)
    resolved = await resolve_access_token(db, token)
    if resolved is None:
        raise http_error(
            403,
            "A2A routes require a household access key with full scope (*)",
            error_code=FORBIDDEN,
        )
    request.state.access_key_id = resolved["id"]
    request.state.access_key_scopes = list(resolved["scopes"])
    await touch_access_key_last_used(db, resolved["id"])
    return resolved


async def require_a2a_agent(request: Request) -> None:
    """Access key must be full-scope ``*`` (read-only keys cannot call A2A)."""
    await require_household_access_key(request)
    scopes = list(getattr(request.state, "access_key_scopes", None) or [])
    if not scopes_allow_full(scopes):
        raise http_error(
            403,
            "Access key missing required scope: *",
            error_code=FORBIDDEN,
        )
