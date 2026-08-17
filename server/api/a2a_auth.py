"""Shared auth for A2A / MCP protocol surfaces: full household access key.

Device sessions are rejected. Loopback exemption does **not** apply — external
agents must present a household access key with full scope ``*``.
"""

from __future__ import annotations

from fastapi import Request

from server.api.deps import get_db
from server.auth import presented_token
from server.auth.access_keys import (
    resolve_access_token,
    scopes_allow_full,
    touch_access_key_last_used,
)
from server.config import get_config_bool
from server.db.database import Database
from server.errors import FORBIDDEN, http_error

A2A_DISABLED_MESSAGE = "A2A is disabled (a2a_enabled=false)"


async def is_a2a_enabled(db: Database) -> bool:
    """Household master switch for A2A HTTP (default on; independent of MCP)."""
    return await get_config_bool(db, "a2a_enabled")


async def require_a2a_enabled(request: Request) -> None:
    """Reject A2A HTTP with 403 when the household master switch is off."""
    if not await is_a2a_enabled(get_db(request)):
        raise http_error(403, A2A_DISABLED_MESSAGE, error_code=FORBIDDEN)


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


async def require_full_access_key(request: Request) -> None:
    """Access key must be full-scope ``*`` (read-only keys cannot call A2A/MCP)."""
    await require_household_access_key(request)
    scopes = list(getattr(request.state, "access_key_scopes", None) or [])
    if not scopes_allow_full(scopes):
        raise http_error(
            403,
            "Access key missing required scope: *",
            error_code=FORBIDDEN,
        )
