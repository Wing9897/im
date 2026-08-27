"""Local FastAPI proxy for IntelligenceCalendar (renderer never talks to it)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query, Request

from server.api.deps import API_DEPS, get_db, require_row
from server.api.schemas.requests.calendar_share import (
    CalendarShareLoginBody,
    CalendarSharePublishBody,
    CalendarShareSubscribeBody,
    CalendarShareTimezoneBody,
)
from server.api.schemas.responses.calendar_share import (
    CalendarSharePublishStateResponse,
    CalendarShareSearchResponse,
    CalendarShareSessionResponse,
    CalendarShareSubscriptionEventsResponse,
    CalendarShareSubscriptionsResponse,
    CalendarShareTimezoneResponse,
)
from server.calendar_share import remote as calendar_share_remote
from server.calendar_share.events import project_subscription_window
from server.calendar_share.publish import push_workset_calendar
from server.calendar_share.remote import (
    CalendarShareRemoteError,
    authorized_request,
    login_remote,
    logout_remote,
    raise_remote_status,
)
from server.calendar_share.store import (
    clear_session,
    drop_legacy_subscription_cache,
    empty_workset_entry,
    get_base_url,
    get_handle,
    get_refresh_token,
    get_timezone_state,
    get_workset_entry,
    mark_public_timezone_result,
    normalize_base_url,
    normalize_handle,
    normalize_slug,
    parse_calendar_path,
    save_calendar_timezone,
    save_session,
    session_connected,
    sync_pending_public_timezone,
    upsert_workset_entry,
)
from server.calendar_share.timezone import normalize_iana_timezone, push_public_timezone
from server.errors import VALIDATION_ERROR, http_error
from server.time_iso import parse_iso
from server.worksets_const import SYSTEM_WORKSET_ID

router = APIRouter(prefix="/api/v1/calendar-share", tags=["calendar-share"], dependencies=API_DEPS)


def _session_payload(base_url: str, handle: str, connected: bool) -> CalendarShareSessionResponse:
    return CalendarShareSessionResponse.model_validate(
        {
            "connected": connected,
            "baseUrl": base_url,
            "handle": handle,
            "status": "connected" if connected else "disconnected",
        }
    )


def _publish_payload(entry: dict[str, Any], *, workset_id: str, is_system: bool) -> CalendarSharePublishStateResponse:
    return CalendarSharePublishStateResponse.model_validate(
        {
            **entry,
            "worksetId": workset_id,
            "isSystemWorkset": is_system,
        }
    )


def _timezone_payload(state: dict[str, Any]) -> CalendarShareTimezoneResponse:
    return CalendarShareTimezoneResponse.model_validate(state)


@router.get("/session", response_model=CalendarShareSessionResponse)
async def get_session(request: Request) -> CalendarShareSessionResponse:
    db = get_db(request)
    await drop_legacy_subscription_cache(db)
    return _session_payload(await get_base_url(db), await get_handle(db), await session_connected(db))


@router.post("/session", response_model=CalendarShareSessionResponse)
async def login_session(request: Request, body: CalendarShareLoginBody) -> CalendarShareSessionResponse:
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
    ok = await push_public_timezone(db, timezone)
    await mark_public_timezone_result(db, timezone, ok=ok)
    return _timezone_payload(await get_timezone_state(db))


@router.get("/publish/{workset_id}", response_model=CalendarSharePublishStateResponse)
async def get_publish_state(request: Request, workset_id: str) -> CalendarSharePublishStateResponse:
    db = get_db(request)
    row = await require_row(db, "worksets", "Workset", workset_id)
    entry = await get_workset_entry(db, workset_id)
    is_system = bool(row.get("is_system")) or workset_id == SYSTEM_WORKSET_ID
    return _publish_payload(entry, workset_id=workset_id, is_system=is_system)


@router.put("/publish/{workset_id}", response_model=CalendarSharePublishStateResponse)
async def put_publish_state(
    request: Request,
    workset_id: str,
    body: CalendarSharePublishBody,
) -> CalendarSharePublishStateResponse:
    db = get_db(request)
    row = await require_row(db, "worksets", "Workset", workset_id)
    is_system = bool(row.get("is_system")) or workset_id == SYSTEM_WORKSET_ID
    slug = normalize_slug(body.slug)
    grants = [{"handle": normalize_handle(g.handle), "visibility": g.visibility} for g in body.grants]
    previous = await get_workset_entry(db, workset_id)
    entry = {
        **empty_workset_entry(workset_id, slug=slug),
        **previous,
        "slug": slug,
        "enabled": body.enabled,
        "autoSync": body.autoSync,
        "publicVisibility": body.publicVisibility,
        "grants": grants,
        "lastSyncAt": previous.get("lastSyncAt"),
        "lastError": previous.get("lastError"),
    }
    saved = await upsert_workset_entry(db, workset_id, entry)
    should_sync = body.syncNow or (body.enabled and body.autoSync) or (not body.enabled and previous.get("enabled"))
    if should_sync:
        if not await session_connected(db):
            saved = await upsert_workset_entry(
                db,
                workset_id,
                {**saved, "lastError": "Not signed in to calendar share"},
            )
        else:
            saved = await push_workset_calendar(
                db,
                workset_id=workset_id,
                entry=saved,
                unpublish=not body.enabled,
            )
    return _publish_payload(saved, workset_id=workset_id, is_system=is_system)


def _search_items(payload: object) -> list[dict[str, str]]:
    rows = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        return []
    items: list[dict[str, str]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        handle = str(row.get("handle") or "").strip()
        slug = str(row.get("slug") or "").strip()
        visibility = str(row.get("visibility") or "").strip()
        if not handle or not slug or visibility not in ("busy", "details"):
            continue
        items.append({"handle": handle, "slug": slug, "visibility": visibility})
    return items


def _subscription_items(payload: object) -> list[dict[str, str]]:
    rows = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        rows = payload.get("calendars") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        return []
    items: list[dict[str, str]] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        handle = str(row.get("handle") or "").strip()
        slug = str(row.get("slug") or "").strip()
        if not handle or not slug:
            continue
        key = f"{handle}/{slug}"
        if key in seen:
            continue
        seen.add(key)
        items.append({"handle": handle, "slug": slug})
    return items


async def _fetch_subscription_items(db: Any) -> list[dict[str, str]]:
    payload = await authorized_request(db, method="GET", path="/me/subscriptions")
    return _subscription_items(payload)


@router.get("/search", response_model=CalendarShareSearchResponse)
async def search_calendars(
    request: Request,
    q: str = Query(default=""),
) -> CalendarShareSearchResponse:
    db = get_db(request)
    query = {"q": q.strip()}
    if await session_connected(db):
        payload = await authorized_request(db, method="GET", path="/search", query=query)
        return CalendarShareSearchResponse.model_validate({"items": _search_items(payload)})
    base_url = await get_base_url(db)
    try:
        status, payload = await calendar_share_remote.calendar_share_request(
            base_url=base_url,
            method="GET",
            path="/search",
            query=query,
        )
    except CalendarShareRemoteError as exc:
        raise http_error(502, exc.message) from exc
    if status >= 400:
        raise_remote_status(status, payload, fallback="Calendar search failed")
    return CalendarShareSearchResponse.model_validate({"items": _search_items(payload)})


@router.get("/subscriptions", response_model=CalendarShareSubscriptionsResponse)
async def list_subscriptions(request: Request) -> CalendarShareSubscriptionsResponse:
    db = get_db(request)
    await drop_legacy_subscription_cache(db)
    own = await get_handle(db)
    if not await session_connected(db):
        return CalendarShareSubscriptionsResponse.model_validate({"items": [], "ownHandle": own})
    items = await _fetch_subscription_items(db)
    return CalendarShareSubscriptionsResponse.model_validate({"items": items, "ownHandle": own})


@router.post("/subscriptions", response_model=CalendarShareSubscriptionsResponse)
async def add_remote_subscription(
    request: Request,
    body: CalendarShareSubscribeBody,
) -> CalendarShareSubscriptionsResponse:
    db = get_db(request)
    if body.path and body.path.strip():
        handle, slug = parse_calendar_path(body.path)
    else:
        handle = normalize_handle(body.handle or "")
        slug = normalize_slug(body.slug or "")
    own = await get_handle(db)
    if own and handle.casefold() == own.casefold():
        raise http_error(422, "Cannot subscribe to your own calendar", error_code=VALIDATION_ERROR)
    if not await session_connected(db):
        raise http_error(401, "Not signed in to calendar share")
    await authorized_request(
        db,
        method="POST",
        path="/me/subscriptions",
        json_body={"handle": handle, "slug": slug},
    )
    items = await _fetch_subscription_items(db)
    return CalendarShareSubscriptionsResponse.model_validate({"items": items, "ownHandle": own})


@router.delete("/subscriptions", response_model=CalendarShareSubscriptionsResponse)
async def delete_subscription(
    request: Request,
    handle: str | None = Query(default=None),
    slug: str | None = Query(default=None),
    path: str | None = Query(default=None),
) -> CalendarShareSubscriptionsResponse:
    db = get_db(request)
    if path and path.strip():
        parsed_handle, parsed_slug = parse_calendar_path(path)
    else:
        parsed_handle = normalize_handle(handle or "")
        parsed_slug = normalize_slug(slug or "")
    if not await session_connected(db):
        raise http_error(401, "Not signed in to calendar share")
    await authorized_request(
        db,
        method="DELETE",
        path="/me/subscriptions",
        query={"handle": parsed_handle, "slug": parsed_slug},
    )
    items = await _fetch_subscription_items(db)
    return CalendarShareSubscriptionsResponse.model_validate({"items": items, "ownHandle": await get_handle(db)})


@router.get("/subscriptions/events", response_model=CalendarShareSubscriptionEventsResponse)
async def list_subscription_events(
    request: Request,
    from_time: str | None = Query(default=None, alias="from"),
    to_time: str | None = Query(default=None, alias="to"),
) -> CalendarShareSubscriptionEventsResponse:
    if not from_time or not to_time:
        raise http_error(422, "from and to are required (ISO-8601)", error_code=VALIDATION_ERROR)
    db = get_db(request)
    if not await session_connected(db):
        return CalendarShareSubscriptionEventsResponse.model_validate({"items": []})
    range_start = parse_iso(from_time)
    range_end = parse_iso(to_time)
    if range_start is None or range_end is None:
        raise http_error(422, "from and to are required (ISO-8601)", error_code=VALIDATION_ERROR)
    if range_end <= range_start:
        raise http_error(422, "to must be after from", error_code=VALIDATION_ERROR)
    payload = await authorized_request(
        db,
        method="GET",
        path="/me/subscriptions/events",
        query={"from": from_time, "to": to_time},
    )
    items = project_subscription_window(payload, range_start, range_end)
    return CalendarShareSubscriptionEventsResponse.model_validate({"items": items})
