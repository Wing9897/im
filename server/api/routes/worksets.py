"""Worksets CRUD — ownership dimension for analysis tasks, items, and events."""

from __future__ import annotations

from fastapi import APIRouter, Request

from server.api.deps import API_DEPS, get_db, publish_resource_modified, require_row
from server.api.schemas.requests import WorksetCreateBody, WorksetUpdateBody
from server.api.schemas.requests.worksets import WORKSET_DESCRIPTION_MAX
from server.api.schemas.responses.worksets import WorksetDeleteResponse, WorksetResponse
from server.db.database import TransactionDb
from server.domain.emoji import EmojiValidationError, normalize_single_grapheme_emoji
from server.errors import FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, http_error
from server.queries.worksets_queries import (
    delete_workset,
    fetch_all_workset_rows,
    fetch_workset_row,
    insert_workset,
    update_workset,
    workset_is_system,
)
from server.util import new_id, utc_now_iso
from server.wire.serializers import serialize_workset
from server.worksets_const import SYSTEM_WORKSET_ID

router = APIRouter(prefix="/api/v1/worksets", tags=["worksets"], dependencies=API_DEPS)


def _notify(request: Request, workset_id: str, action: str) -> None:
    publish_resource_modified(request, "workset", workset_id, action)


def _clean_name(name: str) -> str:
    cleaned = name.strip()
    if not cleaned:
        raise http_error(422, "Workset name is required", error_code=VALIDATION_ERROR)
    return cleaned


def _clean_emoji(value: str | None) -> str:
    try:
        return normalize_single_grapheme_emoji(value)
    except EmojiValidationError as exc:
        raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc


def _clean_description(value: str | None) -> str:
    cleaned = "" if value is None else str(value).strip()
    if len(cleaned) > WORKSET_DESCRIPTION_MAX:
        raise http_error(
            422,
            f"Workset description must be <= {WORKSET_DESCRIPTION_MAX} characters",
            error_code=VALIDATION_ERROR,
        )
    return cleaned


@router.get("", response_model=list[WorksetResponse])
async def list_worksets(request: Request) -> list[WorksetResponse]:
    rows = await fetch_all_workset_rows(get_db(request))
    return [WorksetResponse.model_validate(serialize_workset(row)) for row in rows]


@router.post("", status_code=201, response_model=WorksetResponse)
async def create_workset(request: Request, body: WorksetCreateBody) -> WorksetResponse:
    name = _clean_name(body.name)
    emoji = _clean_emoji(body.emoji)
    description = _clean_description(body.description)
    workset_id = new_id()
    if workset_id == SYSTEM_WORKSET_ID:
        workset_id = new_id()
    now = utc_now_iso()
    db = get_db(request)
    async with db.transaction() as conn:
        await insert_workset(
            TransactionDb(conn),
            workset_id=workset_id,
            name=name,
            now=now,
            notify_enabled=bool(body.notifyEnabled),
            external_enabled=bool(body.externalEnabled),
            emoji=emoji,
            description=description,
        )
    row = await require_row(db, "worksets", "Workset", workset_id)
    _notify(request, workset_id, "created")
    return WorksetResponse.model_validate(serialize_workset(row))


@router.get("/{workset_id}", response_model=WorksetResponse)
async def get_workset(request: Request, workset_id: str) -> WorksetResponse:
    row = await require_row(get_db(request), "worksets", "Workset", workset_id)
    return WorksetResponse.model_validate(serialize_workset(row))


@router.put("/{workset_id}", response_model=WorksetResponse)
async def put_workset(request: Request, workset_id: str, body: WorksetUpdateBody) -> WorksetResponse:
    fields = body.model_fields_set
    if not fields:
        raise http_error(422, "No workset fields to update", error_code=VALIDATION_ERROR)
    db = get_db(request)
    existing = await fetch_workset_row(db, workset_id)
    if existing is None:
        raise http_error(404, "Workset not found", error_code=NOT_FOUND)
    name = _clean_name(body.name) if "name" in fields and body.name is not None else str(existing.get("name") or "")
    if await workset_is_system(db, workset_id) and name != str(existing.get("name") or ""):
        raise http_error(
            403,
            "System workset cannot be renamed",
            error_code=FORBIDDEN,
        )
    notify_enabled = body.notifyEnabled if "notifyEnabled" in fields else None
    external_enabled = body.externalEnabled if "externalEnabled" in fields else None
    emoji = _clean_emoji(body.emoji) if "emoji" in fields else None
    description = _clean_description(body.description) if "description" in fields else None
    now = utc_now_iso()
    async with db.transaction() as conn:
        await update_workset(
            TransactionDb(conn),
            workset_id=workset_id,
            name=name,
            now=now,
            notify_enabled=notify_enabled,
            external_enabled=external_enabled,
            emoji=emoji,
            description=description,
        )
    row = await require_row(db, "worksets", "Workset", workset_id)
    _notify(request, workset_id, "updated")
    if "emoji" in fields or "description" in fields:
        from server.calendar_share.dirty import mark_published_workset_dirty

        await mark_published_workset_dirty(db, workset_id)
    return WorksetResponse.model_validate(serialize_workset(row))


@router.delete("/{workset_id}", response_model=WorksetDeleteResponse)
async def remove_workset(request: Request, workset_id: str) -> WorksetDeleteResponse:
    db = get_db(request)
    existing = await fetch_workset_row(db, workset_id)
    if existing is None:
        raise http_error(404, "Workset not found", error_code=NOT_FOUND)
    if await workset_is_system(db, workset_id):
        raise http_error(
            403,
            "System workset cannot be deleted",
            error_code=FORBIDDEN,
        )
    async with db.transaction() as conn:
        await delete_workset(TransactionDb(conn), workset_id)
    from server.calendar_share.dirty import mark_published_workset_dirty

    await mark_published_workset_dirty(db, workset_id, SYSTEM_WORKSET_ID)
    _notify(request, workset_id, "deleted")
    return WorksetDeleteResponse(ok=True)
