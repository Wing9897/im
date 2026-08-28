"""Low-level HTTP transport for the public calendar-share server."""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlencode

import aiohttp

from server.calendar_share.remote_errors import (
    CalendarShareRemoteError,
    _message_from_payload,
    raise_remote_status,
)
from server.calendar_share.store import (
    clear_tokens,
    get_access_token,
    get_base_url,
    get_refresh_token,
)
from server.db.database import Database
from server.errors import AUTH_REQUIRED, CALENDAR_SHARE_REQUEST_FAILED, CALENDAR_SHARE_UNREACHABLE, http_error

logger = logging.getLogger(__name__)

_TIMEOUT = aiohttp.ClientTimeout(total=15, connect=5, sock_read=12)
_WRITE_TIMEOUT = aiohttp.ClientTimeout(total=60, connect=5, sock_read=45)
_USER_AGENT = "IntelligenceMonitor/calendar-share"


def _timeout_for(method: str, path: str) -> aiohttp.ClientTimeout:
    if method.upper() in {"PUT", "PATCH", "DELETE"} and "/calendars" in path:
        return _WRITE_TIMEOUT
    return _TIMEOUT


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


async def authorized_request_raw(
    db: Database,
    *,
    method: str,
    path: str,
    json_body: Any | None = None,
    query: dict[str, str] | None = None,
) -> tuple[int, Any]:
    from server.calendar_share.remote_auth import rotate_access_token

    base_url = await get_base_url(db)
    access = await get_access_token(db)
    refresh = await get_refresh_token(db)
    if not access and not refresh:
        raise http_error(401, "Not signed in to calendar share", error_code=AUTH_REQUIRED)

    async def _once(token: str) -> tuple[int, Any]:
        from server.calendar_share.remote import calendar_share_request

        return await calendar_share_request(
            base_url=base_url,
            method=method,
            path=path,
            json_body=json_body,
            query=query,
            access_token=token,
        )

    if not access and refresh:
        access = await rotate_access_token(db, base_url, stale_access="", refresh=refresh)

    used_access = access
    try:
        status, payload = await _once(used_access)
    except CalendarShareRemoteError as exc:
        if exc.status == 502:
            raise http_error(502, exc.message, error_code=CALENDAR_SHARE_UNREACHABLE) from exc
        raise

    if status == 401 and refresh:
        access = await rotate_access_token(db, base_url, stale_access=used_access, refresh=refresh)
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
