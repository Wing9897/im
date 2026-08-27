"""Local FastAPI proxy for IntelligenceCalendar (renderer never talks to it)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query, Request

from server.api.deps import API_DEPS, get_db
from server.api.schemas.requests.calendar_share import (
    CalendarShareLoginBody,
    CalendarSharePublishBody,
    CalendarShareSubscribeBody,
    CalendarShareTimezoneBody,
)
from server.api.schemas.responses.calendar_share import (
    CalendarSharePublishListItemResponse,
    CalendarSharePublishListResponse,
    CalendarSharePublishStateResponse,
    CalendarShareSearchResponse,
    CalendarShareSessionResponse,
    CalendarShareSubscriptionEventsResponse,
    CalendarShareSubscriptionsResponse,
    CalendarShareTimezoneResponse,
)
from server.calendar_share import remote as calendar_share_remote
from server.calendar_share.constants import LISTING_PUBLIC, LISTING_PUBLIC_BUSY, VISIBILITY_GRANT
from server.calendar_share.events import project_subscription_window
from server.calendar_share.publish import push_workset_calendar, unpublish_workset_calendar
from server.calendar_share.rate_limit import enforce_calendar_share_rate_limit
from server.calendar_share.remote import (
    CalendarShareRemoteError,
    authorized_request,
    authorized_request_raw,
    login_remote,
    logout_remote,
    raise_remote_status,
)
from server.calendar_share.store import (
    clear_session,
    coerce_publish_slug,
    drop_legacy_subscription_cache,
    empty_workset_entry,
    get_base_url,
    get_handle,
    get_refresh_token,
    get_timezone_state,
    get_workset_entry,
    is_published_entry,
    list_publish_joined,
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
from server.errors import AUTH_REQUIRED, NOT_FOUND, VALIDATION_ERROR, http_error
from server.queries.worksets_queries import fetch_workset_row
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


def _workset_is_system(row: dict[str, Any] | None, workset_id: str) -> bool:
    return (bool(row.get("is_system")) if row else False) or workset_id == SYSTEM_WORKSET_ID


@router.get("/publish", response_model=CalendarSharePublishListResponse)
async def list_publish_states(request: Request) -> CalendarSharePublishListResponse:
    """Return this device's published worksets. Does not call IntelligenceCalendar."""
    enforce_calendar_share_rate_limit(request, "publishList")
    db = get_db(request)
    rows = await list_publish_joined(db)
    items = [CalendarSharePublishListItemResponse.model_validate(row) for row in rows]
    return CalendarSharePublishListResponse(items=items)


@router.get("/publish/{workset_id}", response_model=CalendarSharePublishStateResponse)
async def get_publish_state(request: Request, workset_id: str) -> CalendarSharePublishStateResponse:
    enforce_calendar_share_rate_limit(request, "publishList")
    db = get_db(request)
    row = await fetch_workset_row(db, workset_id)
    entry = await get_workset_entry(db, workset_id)
    if row is None and not is_published_entry(entry):
        raise http_error(404, f"Workset {workset_id} not found", error_code=NOT_FOUND)
    return _publish_payload(entry, workset_id=workset_id, is_system=_workset_is_system(row, workset_id))


@router.put("/publish/{workset_id}", response_model=CalendarSharePublishStateResponse)
async def put_publish_state(
    request: Request,
    workset_id: str,
    body: CalendarSharePublishBody,
) -> CalendarSharePublishStateResponse:
    enforce_calendar_share_rate_limit(request, "publish")
    db = get_db(request)
    row = await fetch_workset_row(db, workset_id)
    previous = await get_workset_entry(db, workset_id)
    if row is None:
        raise http_error(
            404 if not is_published_entry(previous) else 422,
            "Workset not found" if not is_published_entry(previous) else "Cannot publish a deleted workset",
            error_code=NOT_FOUND if not is_published_entry(previous) else VALIDATION_ERROR,
        )
    is_system = _workset_is_system(row, workset_id)
    slug = normalize_slug(coerce_publish_slug(body.slug))
    grants = [{"handle": normalize_handle(g.handle), "visibility": g.visibility} for g in body.grants]
    entry = {
        **empty_workset_entry(workset_id, slug=slug),
        **previous,
        "slug": slug,
        "publicVisibility": body.publicVisibility,
        "grants": grants,
        "lastSyncAt": previous.get("lastSyncAt"),
        "lastError": previous.get("lastError"),
    }
    saved = await upsert_workset_entry(db, workset_id, entry)
    if body.syncNow:
        if not await session_connected(db):
            saved = await upsert_workset_entry(
                db,
                workset_id,
                {**saved, "lastError": AUTH_REQUIRED},
            )
        else:
            saved = await push_workset_calendar(db, workset_id=workset_id, entry=saved)
    return _publish_payload(saved, workset_id=workset_id, is_system=is_system)


@router.delete("/publish/{workset_id}", response_model=CalendarSharePublishStateResponse)
async def delete_publish_state(request: Request, workset_id: str) -> CalendarSharePublishStateResponse:
    """Unpublish: DELETE the IC calendar and drop the local publish row."""
    enforce_calendar_share_rate_limit(request, "publish")
    db = get_db(request)
    row = await fetch_workset_row(db, workset_id)
    entry = await get_workset_entry(db, workset_id)
    if row is None and not is_published_entry(entry):
        raise http_error(404, f"Workset {workset_id} not found", error_code=NOT_FOUND)
    if not is_published_entry(entry):
        return _publish_payload(entry, workset_id=workset_id, is_system=_workset_is_system(row, workset_id))
    if not await session_connected(db):
        saved = await upsert_workset_entry(db, workset_id, {**entry, "lastError": AUTH_REQUIRED})
        return _publish_payload(saved, workset_id=workset_id, is_system=_workset_is_system(row, workset_id))
    saved = await unpublish_workset_calendar(db, workset_id=workset_id, entry=entry)
    return _publish_payload(saved, workset_id=workset_id, is_system=_workset_is_system(row, workset_id))


def _catalog_fields(row: dict[str, Any]) -> dict[str, str]:
    return {
        "emoji": str(row.get("emoji") or ""),
        "description": str(row.get("description") or ""),
    }


def _search_items(payload: object) -> list[dict[str, str]]:
    rows = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        return []
    items: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        handle = str(row.get("handle") or "").strip()
        slug = str(row.get("slug") or "").strip()
        if not handle or not slug:
            continue
        hit_kind = str(row.get("hitKind") or "").strip()
        listing = str(row.get("publicVisibility") or "").strip()
        grant = str(row.get("visibility") or "").strip()
        if hit_kind not in {"listing", "grant"}:
            if listing in {LISTING_PUBLIC, LISTING_PUBLIC_BUSY}:
                hit_kind = "listing"
            elif grant in VISIBILITY_GRANT:
                hit_kind = "grant"
            else:
                continue
        item: dict[str, Any] = {"handle": handle, "slug": slug, "hitKind": hit_kind, **_catalog_fields(row)}
        if hit_kind == "listing":
            vis = listing or str(row.get("visibility") or "")
            if vis not in {LISTING_PUBLIC, LISTING_PUBLIC_BUSY}:
                continue
            item["publicVisibility"] = vis
        else:
            if grant not in VISIBILITY_GRANT:
                continue
            item["visibility"] = grant
        items.append(item)
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
        items.append({"handle": handle, "slug": slug, **_catalog_fields(row)})
    return items


async def _fetch_subscription_items(db: Any) -> list[dict[str, str]]:
    status, payload = await authorized_request_raw(db, method="GET", path="/me/subscriptions")
    if status == 404:
        return []
    if status >= 400:
        raise_remote_status(status, payload, fallback_code="CALENDAR_SHARE_REQUEST_FAILED")
    return _subscription_items(payload)


def _search_response(status: int, payload: object) -> CalendarShareSearchResponse:
    if status == 404:
        return CalendarShareSearchResponse.model_validate({"items": []})
    if status >= 400:
        raise_remote_status(status, payload, fallback_code="CALENDAR_SHARE_REQUEST_FAILED")
    return CalendarShareSearchResponse.model_validate({"items": _search_items(payload)})


@router.get("/search", response_model=CalendarShareSearchResponse)
async def search_calendars(
    request: Request,
    q: str = Query(default=""),
) -> CalendarShareSearchResponse:
    enforce_calendar_share_rate_limit(request, "search")
    db = get_db(request)
    query = {"q": q.strip()}
    if await session_connected(db):
        status, payload = await authorized_request_raw(db, method="GET", path="/search", query=query)
        return _search_response(status, payload)
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
    return _search_response(status, payload)


@router.get("/subscriptions", response_model=CalendarShareSubscriptionsResponse)
async def list_subscriptions(request: Request) -> CalendarShareSubscriptionsResponse:
    enforce_calendar_share_rate_limit(request, "catalog")
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
    enforce_calendar_share_rate_limit(request, "subscribe")
    db = get_db(request)
    if body.path and body.path.strip():
        handle, slug = parse_calendar_path(body.path)
    else:
        handle = normalize_handle(body.handle or "")
        slug = normalize_slug(body.slug or "", allow_legacy=True)
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
    enforce_calendar_share_rate_limit(request, "unsubscribe")
    db = get_db(request)
    if path and path.strip():
        parsed_handle, parsed_slug = parse_calendar_path(path)
    else:
        parsed_handle = normalize_handle(handle or "")
        parsed_slug = normalize_slug(slug or "", allow_legacy=True)
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
    enforce_calendar_share_rate_limit(request, "public_events")
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
