"""Remote subscription catalog and subscription events."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query, Request

from server.api.deps import get_db
from server.api.schemas.requests.calendar_share import CalendarShareSubscribeBody
from server.api.schemas.responses.calendar_share import (
    CalendarShareSubscriptionEventsResponse,
    CalendarShareSubscriptionsResponse,
)
from server.calendar_share.events import project_subscription_window
from server.calendar_share.rate_limit import enforce_calendar_share_rate_limit
from server.calendar_share.remote import authorized_request, authorized_request_raw, raise_remote_status
from server.calendar_share.store import (
    get_handle,
    normalize_handle,
    normalize_slug,
    parse_calendar_path,
    session_connected,
)
from server.errors import VALIDATION_ERROR, http_error
from server.time_iso import parse_iso
from server.wire.serializers import serialize_catalog_wire_fields

router = APIRouter(tags=["calendar-share"])


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
        items.append({"handle": handle, "slug": slug, **serialize_catalog_wire_fields(row)})
    return items


async def _fetch_subscription_items(db: Any) -> list[dict[str, str]]:
    status, payload = await authorized_request_raw(db, method="GET", path="/me/subscriptions")
    if status == 404:
        return []
    if status >= 400:
        raise_remote_status(status, payload, fallback_code="CALENDAR_SHARE_REQUEST_FAILED")
    return _subscription_items(payload)


@router.get("/subscriptions", response_model=CalendarShareSubscriptionsResponse)
async def list_subscriptions(request: Request) -> CalendarShareSubscriptionsResponse:
    enforce_calendar_share_rate_limit(request, "catalog")
    db = get_db(request)
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
