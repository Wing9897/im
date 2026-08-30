"""Local workset publish HTTP routes (does not list remote calendars).

Named ``publish_routes`` so it does not collide with ``server.calendar_share.publish``
or ``server.calendar_share.store.publish``.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from server.api.deps import get_db
from server.api.schemas.requests.calendar_share import CalendarSharePublishAutoSyncBody, CalendarSharePublishBody
from server.api.schemas.responses.calendar_share import (
    CalendarSharePublishListItemResponse,
    CalendarSharePublishListResponse,
    CalendarSharePublishStateResponse,
)
from server.calendar_share.auto_sync_config import (
    AUTO_SYNC_INTERVAL_FLOOR_SECONDS,
    apply_unified_auto_sync,
    normalize_auto_sync_interval_seconds,
    read_unified_auto_sync,
)
from server.calendar_share.publish import push_workset_calendar, unpublish_workset_calendar
from server.calendar_share.rate_limit import enforce_calendar_share_rate_limit
from server.calendar_share.store import (
    coerce_publish_slug,
    empty_workset_entry,
    get_workset_entry,
    is_published_entry,
    list_publish_joined,
    normalize_handle,
    normalize_slug,
    session_connected,
    upsert_workset_entry,
)
from server.errors import AUTH_REQUIRED, NOT_FOUND, VALIDATION_ERROR, http_error
from server.queries.worksets_queries import fetch_workset_row
from server.worksets_const import SYSTEM_WORKSET_ID

router = APIRouter(tags=["calendar-share"])


def _publish_payload(entry: dict[str, Any], *, workset_id: str, is_system: bool) -> CalendarSharePublishStateResponse:
    return CalendarSharePublishStateResponse.model_validate(
        {
            **entry,
            "worksetId": workset_id,
            "isSystemWorkset": is_system,
        }
    )


def _workset_is_system(row: dict[str, Any] | None, workset_id: str) -> bool:
    return (bool(row.get("is_system")) if row else False) or workset_id == SYSTEM_WORKSET_ID


@router.get("/publish", response_model=CalendarSharePublishListResponse)
async def list_publish_states(request: Request) -> CalendarSharePublishListResponse:
    """Return this device's published worksets. Does not call IntelligenceCalendar."""
    enforce_calendar_share_rate_limit(request, "publishList")
    db = get_db(request)
    rows = await list_publish_joined(db)
    items = [CalendarSharePublishListItemResponse.model_validate(row) for row in rows]
    auto_sync, interval = await read_unified_auto_sync(db)
    return CalendarSharePublishListResponse(
        items=items,
        autoSync=auto_sync,
        autoSyncIntervalSeconds=interval,
        autoSyncIntervalFloorSeconds=AUTO_SYNC_INTERVAL_FLOOR_SECONDS,
    )


@router.patch("/publish/auto-sync", response_model=CalendarSharePublishListResponse)
async def patch_publish_auto_sync(
    request: Request,
    body: CalendarSharePublishAutoSyncBody,
) -> CalendarSharePublishListResponse:
    """Household-wide auto-update for every published workset."""
    if body.autoSync is None and body.autoSyncIntervalSeconds is None:
        raise http_error(422, "Provide autoSync and/or autoSyncIntervalSeconds", error_code=VALIDATION_ERROR)
    enforce_calendar_share_rate_limit(request, "publish")
    if body.autoSyncIntervalSeconds is not None and body.autoSyncIntervalSeconds < AUTO_SYNC_INTERVAL_FLOOR_SECONDS:
        raise http_error(
            422,
            f"autoSyncIntervalSeconds must be >= {AUTO_SYNC_INTERVAL_FLOOR_SECONDS}",
            error_code=VALIDATION_ERROR,
        )
    db = get_db(request)
    interval = (
        None
        if body.autoSyncIntervalSeconds is None
        else normalize_auto_sync_interval_seconds(body.autoSyncIntervalSeconds)
    )
    auto_sync, saved_interval = await apply_unified_auto_sync(
        db,
        auto_sync=body.autoSync,
        interval_seconds=interval,
    )
    rows = await list_publish_joined(db)
    items = [CalendarSharePublishListItemResponse.model_validate(row) for row in rows]
    return CalendarSharePublishListResponse(
        items=items,
        autoSync=auto_sync,
        autoSyncIntervalSeconds=saved_interval,
        autoSyncIntervalFloorSeconds=AUTO_SYNC_INTERVAL_FLOOR_SECONDS,
    )


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
    auto_sync, interval = await read_unified_auto_sync(db)
    entry = {
        **empty_workset_entry(workset_id, slug=slug),
        **previous,
        "slug": slug,
        "publicVisibility": body.publicVisibility,
        "grants": grants,
        "lastSyncAt": previous.get("lastSyncAt"),
        "lastError": previous.get("lastError"),
        "autoSync": auto_sync,
        "autoSyncIntervalSeconds": interval,
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
