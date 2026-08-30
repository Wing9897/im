"""Public calendar search proxy."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query, Request

from server.api.deps import get_db
from server.api.schemas.responses.calendar_share import CalendarShareSearchResponse
from server.calendar_share import remote as calendar_share_remote
from server.calendar_share.constants import LISTING_PUBLIC, LISTING_PUBLIC_BUSY, VISIBILITY_GRANT
from server.calendar_share.rate_limit import enforce_calendar_share_rate_limit
from server.calendar_share.remote import (
    CalendarShareRemoteError,
    authorized_request_raw,
    raise_mapped_remote_error,
    raise_remote_status,
)
from server.calendar_share.store import get_base_url, session_connected
from server.wire.serializers import serialize_catalog_wire_fields

router = APIRouter(tags=["calendar-share"])


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
        wire = serialize_catalog_wire_fields(row)
        item: dict[str, Any] = {"handle": handle, "slug": slug, "hitKind": hit_kind, **wire}
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
        raise_mapped_remote_error(exc)
    return _search_response(status, payload)
