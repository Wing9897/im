"""HTTP client for the public calendar-share server (refresh lives here)."""

from __future__ import annotations

import asyncio
import logging
from typing import Any
from urllib.parse import urlencode

import aiohttp

from server.calendar_share.store import (
    clear_tokens,
    get_access_token,
    get_base_url,
    get_refresh_token,
    save_tokens,
)
from server.db.database import Database
from server.errors import (
    AUTH_REQUIRED,
    CALENDAR_SHARE_REQUEST_FAILED,
    CALENDAR_SHARE_UNREACHABLE,
    NOT_FOUND,
    RATE_LIMITED,
    VALIDATION_ERROR,
    http_error,
)

logger = logging.getLogger(__name__)

_TIMEOUT = aiohttp.ClientTimeout(total=15, connect=5, sock_read=12)
_WRITE_TIMEOUT = aiohttp.ClientTimeout(total=60, connect=5, sock_read=45)
_USER_AGENT = "IntelligenceMonitor/calendar-share"


def _timeout_for(method: str, path: str) -> aiohttp.ClientTimeout:
    if method.upper() in {"PUT", "PATCH", "DELETE"} and "/calendars" in path:
        return _WRITE_TIMEOUT
    return _TIMEOUT
# One IM desktop: serialize refresh so concurrent 401s cannot rotate the same refresh token.
_refresh_lock = asyncio.Lock()


class CalendarShareRemoteError(Exception):
    """Remote calendar server returned a non-success status."""

    def __init__(self, status: int, message: str, payload: Any = None, *, error_code: str | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.message = message
        self.payload = payload
        self.error_code = error_code or _error_code_from_payload(payload) or (
            CALENDAR_SHARE_UNREACHABLE if status == 502 else CALENDAR_SHARE_REQUEST_FAILED
        )


def _error_code_from_payload(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    code = payload.get("error_code")
    if isinstance(code, str) and code.strip():
        return code.strip()
    detail = payload.get("detail")
    if isinstance(detail, dict):
        nested = detail.get("error_code")
        if isinstance(nested, str) and nested.strip():
            return nested.strip()
    return None


def _message_from_payload(payload: Any, fallback: str) -> str:
    if isinstance(payload, dict):
        for key in ("message", "detail", "error"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
            if isinstance(value, dict):
                nested = value.get("message")
                if isinstance(nested, str) and nested.strip():
                    return nested.strip()
            if isinstance(value, list) and value:
                first = value[0]
                if isinstance(first, str) and first.strip():
                    return first.strip()
                if isinstance(first, dict):
                    nested = first.get("msg") or first.get("message")
                    if isinstance(nested, str) and nested.strip():
                        return nested.strip()
        if isinstance(payload.get("error_code"), str) and payload["error_code"].strip():
            return payload["error_code"].strip()
    if isinstance(payload, str) and payload.strip():
        return payload.strip()
    if isinstance(payload, list) and payload:
        return _message_from_payload({"detail": payload}, fallback)
    return fallback


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


async def calendar_share_request(
    *,
    base_url: str,
    method: str,
    path: str,
    json_body: Any | None = None,
    query: dict[str, str] | None = None,
    access_token: str | None = None,
    refresh_token: str | None = None,
) -> tuple[int, Any]:
    """One outbound call. Tests monkeypatch this function."""
    url = f"{base_url.rstrip('/')}{path}"
    if query:
        url = f"{url}?{urlencode(query)}"
    headers = {"Accept": "application/json", "User-Agent": _USER_AGENT}
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    elif refresh_token:
        headers["Authorization"] = f"Bearer {refresh_token}"
    try:
        async with (
            aiohttp.ClientSession(timeout=_timeout_for(method, path)) as session,
            session.request(method, url, json=json_body, headers=headers) as resp,
        ):
            payload: Any
            try:
                payload = await resp.json(content_type=None)
            except (aiohttp.ContentTypeError, ValueError):
                text = await resp.text()
                payload = text if text else None
            return resp.status, payload
    except (TimeoutError, aiohttp.ClientError, OSError) as exc:
        logger.info("Calendar share request failed: %s %s (%s)", method, path, exc)
        raise CalendarShareRemoteError(
            502,
            "Calendar share server unreachable",
            error_code=CALENDAR_SHARE_UNREACHABLE,
        ) from exc


def raise_remote_status(
    status: int,
    payload: Any,
    *,
    fallback_code: str = CALENDAR_SHARE_REQUEST_FAILED,
    fallback: str | None = None,
) -> None:
    """Raise a structured HTTP error. Protocol identity is ``error_code``, not English copy."""
    code = _error_code_from_payload(payload) or fallback_code
    if status == 401:
        code = AUTH_REQUIRED
    elif status == 404:
        code = NOT_FOUND
    elif status == 429:
        code = RATE_LIMITED
    elif status == 403:
        code = _error_code_from_payload(payload) or code
    message = _message_from_payload(payload, fallback or code)
    if status in (401, 403):
        raise http_error(status, message, error_code=AUTH_REQUIRED if status == 401 else code)
    if status == 404:
        raise http_error(404, message, error_code=NOT_FOUND)
    if status == 409:
        raise http_error(409, message, error_code=VALIDATION_ERROR)
    if status == 429:
        raise http_error(429, message, error_code=RATE_LIMITED)
    if 400 <= status < 500:
        raise http_error(422 if status == 400 else status, message, error_code=VALIDATION_ERROR)
    raise http_error(502, message, error_code=code)


async def login_remote(base_url: str, handle: str, password: str) -> tuple[str, str]:
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
        raise http_error(502, "Calendar share login did not return access and refresh tokens")
    return access, refresh


async def refresh_remote(base_url: str, refresh_token: str) -> tuple[str, str]:
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


async def _rotate_access_token(db: Database, base_url: str, *, stale_access: str, refresh: str) -> str:
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


async def authorized_request_raw(
    db: Database,
    *,
    method: str,
    path: str,
    json_body: Any | None = None,
    query: dict[str, str] | None = None,
) -> tuple[int, Any]:
    base_url = await get_base_url(db)
    access = await get_access_token(db)
    refresh = await get_refresh_token(db)
    if not access and not refresh:
        raise http_error(401, "Not signed in to calendar share", error_code=AUTH_REQUIRED)

    async def _once(token: str) -> tuple[int, Any]:
        return await calendar_share_request(
            base_url=base_url,
            method=method,
            path=path,
            json_body=json_body,
            query=query,
            access_token=token,
        )

    if not access and refresh:
        access = await _rotate_access_token(db, base_url, stale_access="", refresh=refresh)

    used_access = access
    try:
        status, payload = await _once(used_access)
    except CalendarShareRemoteError as exc:
        if exc.status == 502:
            raise http_error(502, exc.message, error_code=CALENDAR_SHARE_UNREACHABLE) from exc
        raise

    if status == 401 and refresh:
        access = await _rotate_access_token(db, base_url, stale_access=used_access, refresh=refresh)
        try:
            status, payload = await _once(access)
        except CalendarShareRemoteError as exc:
            if exc.status == 502:
                raise http_error(502, exc.message, error_code=CALENDAR_SHARE_UNREACHABLE) from exc
            raise

    if status == 401:
        await clear_tokens(db)
        raise http_error(
            401,
            _message_from_payload(payload, "Calendar share session expired"),
            error_code=AUTH_REQUIRED,
        )
    return status, payload


async def authorized_request(
    db: Database,
    *,
    method: str,
    path: str,
    json_body: Any | None = None,
    query: dict[str, str] | None = None,
) -> Any:
    status, payload = await authorized_request_raw(
        db,
        method=method,
        path=path,
        json_body=json_body,
        query=query,
    )
    if status >= 400:
        raise_remote_status(status, payload, fallback_code=CALENDAR_SHARE_REQUEST_FAILED)
    return payload
