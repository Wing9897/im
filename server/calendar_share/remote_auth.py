"""Token login, refresh, and rotation for calendar-share remote calls."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from server.calendar_share.remote_errors import CalendarShareRemoteError, _message_from_payload, raise_remote_status
from server.calendar_share.store import (
    clear_tokens,
    get_access_token,
    get_refresh_token,
    save_tokens,
)
from server.db.database import Database
from server.errors import AUTH_REQUIRED, CALENDAR_SHARE_REQUEST_FAILED, http_error

logger = logging.getLogger(__name__)

# One IM desktop: serialize refresh so concurrent 401s cannot rotate the same refresh token.
_refresh_lock = asyncio.Lock()


def _pick_token(payload: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    nested = payload.get("data")
    if isinstance(nested, dict):
        return _pick_token(nested, *keys)
    tokens = payload.get("tokens")
    if isinstance(tokens, dict):
        return _pick_token(tokens, *keys)
    return ""


def parse_token_pair(payload: Any) -> tuple[str, str]:
    if not isinstance(payload, dict):
        return "", ""
    access = _pick_token(payload, "accessToken", "access", "access_token")
    refresh = _pick_token(payload, "refreshToken", "refresh", "refresh_token")
    return access, refresh


async def login_remote(base_url: str, handle: str, password: str) -> tuple[str, str]:
    from server.calendar_share.remote import calendar_share_request

    status, payload = await calendar_share_request(
        base_url=base_url,
        method="POST",
        path="/auth/login",
        json_body={"handle": handle, "password": password},
    )
    if status >= 400:
        raise_remote_status(status, payload, fallback_code=CALENDAR_SHARE_REQUEST_FAILED)
    access, refresh = parse_token_pair(payload)
    if not access or not refresh:
        raise http_error(
            502,
            "Calendar share login did not return access and refresh tokens",
            error_code=CALENDAR_SHARE_REQUEST_FAILED,
        )
    return access, refresh


async def refresh_remote(base_url: str, refresh_token: str) -> tuple[str, str]:
    from server.calendar_share.remote import calendar_share_request

    status, payload = await calendar_share_request(
        base_url=base_url,
        method="POST",
        path="/auth/refresh",
        json_body={"refresh": refresh_token, "refreshToken": refresh_token},
        refresh_token=refresh_token,
    )
    if status >= 400:
        raise CalendarShareRemoteError(status, _message_from_payload(payload, "Refresh failed"), payload)
    access, refresh = parse_token_pair(payload)
    if not access:
        raise CalendarShareRemoteError(401, "Refresh did not return an access token", payload)
    return access, refresh or refresh_token


async def logout_remote(base_url: str, refresh_token: str) -> None:
    from server.calendar_share.remote import calendar_share_request

    try:
        await calendar_share_request(
            base_url=base_url,
            method="POST",
            path="/auth/logout",
            json_body={"refresh": refresh_token, "refreshToken": refresh_token},
            refresh_token=refresh_token,
        )
    except CalendarShareRemoteError:
        logger.info("Calendar share remote logout failed; local tokens still cleared")


async def rotate_access_token(db: Database, base_url: str, *, stale_access: str, refresh: str) -> str:
    """Refresh under a process lock; reuse a token another caller already rotated."""
    async with _refresh_lock:
        current_access = await get_access_token(db)
        current_refresh = await get_refresh_token(db)
        if current_access and current_access != stale_access:
            return current_access
        token = current_refresh or refresh
        if not token:
            await clear_tokens(db)
            raise http_error(401, "Not signed in to calendar share", error_code=AUTH_REQUIRED)
        try:
            access, new_refresh = await refresh_remote(base_url, token)
            await save_tokens(db, access_token=access, refresh_token=new_refresh)
            return access
        except CalendarShareRemoteError as exc:
            await clear_tokens(db)
            raise http_error(401, exc.message, error_code=AUTH_REQUIRED) from exc
