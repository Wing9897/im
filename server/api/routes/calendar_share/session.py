"""Session login, pinned timezone, and profile sync."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from server.api.deps import get_db
from server.api.schemas.requests.calendar_share import (
    USER_AVATAR_MAX_CHARS,
    CalendarShareLoginBody,
    CalendarShareProfileBody,
    CalendarShareTimezoneBody,
)
from server.api.schemas.responses.calendar_share import (
    CalendarShareProfileResponse,
    CalendarShareSessionResponse,
    CalendarShareTimezoneResponse,
)
from server.calendar_share.rate_limit import enforce_calendar_share_rate_limit
from server.calendar_share.remote import (
    CalendarShareRemoteError,
    authorized_request,
    login_remote,
    logout_remote,
)
from server.calendar_share.store import (
    clear_session,
    get_base_url,
    get_handle,
    get_refresh_token,
    get_timezone_state,
    mark_public_timezone_result,
    normalize_base_url,
    normalize_handle,
    save_calendar_timezone,
    save_session,
    session_connected,
    sync_pending_public_timezone,
)
from server.calendar_share.timezone import normalize_iana_timezone, push_public_timezone
from server.errors import VALIDATION_ERROR, http_error

router = APIRouter(tags=["calendar-share"])


def _session_payload(base_url: str, handle: str, connected: bool) -> CalendarShareSessionResponse:
    return CalendarShareSessionResponse.model_validate(
        {
            "connected": connected,
            "baseUrl": base_url,
            "handle": handle,
            "status": "connected" if connected else "disconnected",
        }
    )


def _timezone_payload(state: dict[str, Any]) -> CalendarShareTimezoneResponse:
    return CalendarShareTimezoneResponse.model_validate(state)


def _clean_profile_avatar(value: str | None) -> str:
    avatar = "" if value is None else str(value).strip()
    if not avatar:
        return ""
    if not avatar.startswith("data:image/") or len(avatar) > USER_AVATAR_MAX_CHARS:
        raise http_error(
            422,
            f"Invalid avatar: must be a data:image/ URL of at most {USER_AVATAR_MAX_CHARS} chars",
            error_code=VALIDATION_ERROR,
        )
    return avatar


@router.get("/session", response_model=CalendarShareSessionResponse)
async def get_session(request: Request) -> CalendarShareSessionResponse:
    db = get_db(request)
    return _session_payload(await get_base_url(db), await get_handle(db), await session_connected(db))


@router.post("/session", response_model=CalendarShareSessionResponse)
async def login_session(request: Request, body: CalendarShareLoginBody) -> CalendarShareSessionResponse:
    enforce_calendar_share_rate_limit(request, "auth")
    db = get_db(request)
    base_url = normalize_base_url(body.baseUrl)
    handle = normalize_handle(body.handle)
    try:
        access, refresh = await login_remote(base_url, handle, body.password)
    except CalendarShareRemoteError as exc:
        raise http_error(502 if exc.status == 502 else 401, exc.message) from exc
    await save_session(db, base_url=base_url, handle=handle, access_token=access, refresh_token=refresh)
    await sync_pending_public_timezone(db)
    return _session_payload(base_url, handle, True)


@router.delete("/session", response_model=CalendarShareSessionResponse)
async def logout_session(request: Request) -> CalendarShareSessionResponse:
    db = get_db(request)
    base_url = await get_base_url(db)
    handle = await get_handle(db)
    refresh = await get_refresh_token(db)
    if refresh:
        await logout_remote(base_url, refresh)
    await clear_session(db)
    return _session_payload(base_url, handle, False)


@router.get("/timezone", response_model=CalendarShareTimezoneResponse)
async def get_timezone(request: Request) -> CalendarShareTimezoneResponse:
    return _timezone_payload(await get_timezone_state(get_db(request)))


@router.put("/timezone", response_model=CalendarShareTimezoneResponse)
async def put_timezone(request: Request, body: CalendarShareTimezoneBody) -> CalendarShareTimezoneResponse:
    db = get_db(request)
    timezone = normalize_iana_timezone(body.timezone)
    await save_calendar_timezone(db, timezone)
    from server.calendar_share.dirty import mark_all_published_worksets_dirty

    await mark_all_published_worksets_dirty(db)
    ok = await push_public_timezone(db, timezone)
    await mark_public_timezone_result(db, timezone, ok=ok)
    return _timezone_payload(await get_timezone_state(db))


@router.put("/profile", response_model=CalendarShareProfileResponse)
async def put_profile(request: Request, body: CalendarShareProfileBody) -> CalendarShareProfileResponse:
    """Sync local profile avatar to IntelligenceCalendar ``PUT /me``."""
    db = get_db(request)
    if not await session_connected(db):
        raise http_error(401, "Not signed in to calendar share")
    avatar = _clean_profile_avatar(body.avatar)
    payload = await authorized_request(
        db,
        method="PUT",
        path="/me",
        json_body={"avatar": avatar},
    )
    if not isinstance(payload, dict):
        payload = {}
    handle = str(payload.get("handle") or await get_handle(db))
    timezone = str(payload.get("timezone") or "")
    return CalendarShareProfileResponse.model_validate(
        {"handle": handle, "timezone": timezone, "avatar": str(payload.get("avatar") or avatar)}
    )
