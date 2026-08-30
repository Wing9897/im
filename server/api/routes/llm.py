"""LLM profiles and staff-instances CRUD."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from server.api.deps import API_DEPS, get_db, publish_resource_modified, require_row
from server.api.schemas.requests.llm_profiles import (
    LlmGlobalSlotBindBody,
    LlmProfileCopyBody,
    LlmProfileUpsertBody,
)
from server.api.schemas.responses.llm_profiles import (
    LlmGlobalSlotBindingResponse,
    LlmGlobalSlotsResponse,
    LlmProfileDeleteResponse,
    LlmProfileResponse,
    LlmStaffInstanceResponse,
)
from server.db.database import TransactionDb
from server.domain.llm_staff_classes import LLM_STAFF_CLASSES, LLM_TASK_STAFF_CLASSES
from server.domain.web_search_providers import WEB_SEARCH_PROVIDER_DEFAULT, WEB_SEARCH_SECRET_WIRE_FIELDS
from server.errors import NOT_FOUND, VALIDATION_ERROR, http_error
from server.llm_global_slots import (
    LLM_GLOBAL_SLOTS,
    clear_slots_for_profile,
    is_global_slot_id,
    list_global_slots,
    serialize_slot_binding,
    set_global_slot,
)
from server.queries import llm_profiles_queries as q
from server.secrets import MASKED_SECRET
from server.util import new_id, utc_now_iso
from server.wire.serializers import (
    serialize_llm_profile,
    serialize_llm_staff_instance,
)

router = APIRouter(prefix="/api/v1/llm", tags=["llm"], dependencies=API_DEPS)


def _notify_profile(request: Request, profile_id: str, action: str) -> None:
    publish_resource_modified(request, "llm_profile", profile_id, action)


def _create_secret(value: str | None) -> str:
    return "" if value in (None, MASKED_SECRET) else str(value)


def _patch_secret(value: str | None) -> str | None:
    if value is None or value == MASKED_SECRET:
        return None
    return str(value)


def _search_keys_create(body: LlmProfileUpsertBody) -> dict[str, str]:
    return {column: _create_secret(getattr(body, wire)) for column, wire in WEB_SEARCH_SECRET_WIRE_FIELDS}


def _search_keys_patch(body: LlmProfileUpsertBody) -> dict[str, str | None]:
    return {column: _patch_secret(getattr(body, wire)) for column, wire in WEB_SEARCH_SECRET_WIRE_FIELDS}


def _clean_name(name: str) -> str:
    cleaned = name.strip()
    if not cleaned:
        raise http_error(422, "Profile name is required", error_code=VALIDATION_ERROR)
    return cleaned


def _normalize_staff_classes(raw: list[str] | None) -> list[str]:
    """Normalize task-mode staff classes; unknown values are rejected."""
    if not raw:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        value = str(item).strip()
        if value == "assistant":
            # Retired staff class — bind via /llm/global-slots/assistant.
            continue
        if value not in LLM_TASK_STAFF_CLASSES:
            if value not in LLM_STAFF_CLASSES:
                raise http_error(
                    422,
                    f"Invalid staff class: {value}",
                    error_code=VALIDATION_ERROR,
                )
            continue
        if value not in seen:
            seen.add(value)
            out.append(value)
    return out


async def _serialize_global_slots(db: Any) -> LlmGlobalSlotsResponse:
    bindings = await list_global_slots(db)
    slots: list[dict[str, Any]] = []
    for slot in LLM_GLOBAL_SLOTS:
        profile_id = bindings.get(slot)
        row = await q.fetch_profile_row(db, profile_id) if profile_id else None
        if profile_id and row is None:
            profile_id = None
        slots.append(serialize_slot_binding(slot, profile_id, row))
    return LlmGlobalSlotsResponse.model_validate({"slots": slots})


async def _serialize_profile(db: Any, profile_id: str) -> LlmProfileResponse:
    row = await require_row(db, "llm_profiles", "LLM profile", profile_id)
    staff = await q.fetch_staff_rows_for_profiles(db, [profile_id])
    return LlmProfileResponse.model_validate(serialize_llm_profile(row, staff))


@router.get("/profiles", response_model=list[LlmProfileResponse])
async def list_profiles(request: Request) -> list[LlmProfileResponse]:
    db = get_db(request)
    rows = await q.fetch_all_profile_rows(db)
    staff = await q.fetch_staff_rows_for_profiles(db, [str(r["id"]) for r in rows])
    by_profile: dict[str, list[dict[str, Any]]] = {}
    for item in staff:
        by_profile.setdefault(str(item["profile_id"]), []).append(item)
    return [
        LlmProfileResponse.model_validate(serialize_llm_profile(row, by_profile.get(str(row["id"]), [])))
        for row in rows
    ]


@router.post("/profiles", status_code=201, response_model=LlmProfileResponse)
async def create_profile(request: Request, body: LlmProfileUpsertBody) -> LlmProfileResponse:
    name = _clean_name(body.name)
    staff_classes = _normalize_staff_classes(list(body.staffClasses))
    profile_id = new_id()
    now = utc_now_iso()
    db = get_db(request)
    api_key = _create_secret(body.apiKey)
    search_api_keys = _search_keys_create(body)
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await q.insert_profile(
            tx,
            profile_id=profile_id,
            name=name,
            provider=body.provider,
            base_url=body.baseUrl.strip(),
            model=body.model.strip(),
            api_key=api_key,
            thinking_enabled=1 if body.thinkingEnabled else 0,
            json_mode=(body.jsonMode or "disabled").strip() or "disabled",
            web_search_enabled=1 if body.webSearchEnabled else 0,
            # Literal-typed body: unknown providers already rejected with 422.
            web_search_provider=body.webSearchProvider,
            search_api_keys=search_api_keys,
            now=now,
        )
        await q.upsert_staff_classes(tx, profile_id=profile_id, staff_classes=staff_classes, now=now)
    _notify_profile(request, profile_id, "created")
    return await _serialize_profile(db, profile_id)


@router.get("/profiles/{profile_id}", response_model=LlmProfileResponse)
async def get_profile(request: Request, profile_id: str) -> LlmProfileResponse:
    return await _serialize_profile(get_db(request), profile_id)


@router.patch("/profiles/{profile_id}", response_model=LlmProfileResponse)
async def patch_profile(request: Request, profile_id: str, body: LlmProfileUpsertBody) -> LlmProfileResponse:
    db = get_db(request)
    existing = await q.fetch_profile_row(db, profile_id)
    if existing is None:
        raise http_error(404, "LLM profile not found", error_code=NOT_FOUND)
    name = _clean_name(body.name)
    staff_classes = _normalize_staff_classes(list(body.staffClasses))
    now = utc_now_iso()
    api_key: str | None = _patch_secret(body.apiKey)
    search_api_keys = _search_keys_patch(body)
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await q.update_profile(
            tx,
            profile_id=profile_id,
            name=name,
            provider=body.provider,
            base_url=body.baseUrl.strip(),
            model=body.model.strip(),
            api_key=api_key,
            thinking_enabled=1 if body.thinkingEnabled else 0,
            json_mode=(body.jsonMode or "disabled").strip() or "disabled",
            web_search_enabled=1 if body.webSearchEnabled else 0,
            web_search_provider=body.webSearchProvider,
            search_api_keys=search_api_keys,
            now=now,
        )
        await q.upsert_staff_classes(tx, profile_id=profile_id, staff_classes=staff_classes, now=now)
    _notify_profile(request, profile_id, "updated")
    return await _serialize_profile(db, profile_id)


@router.delete("/profiles/{profile_id}", response_model=LlmProfileDeleteResponse)
async def delete_profile(request: Request, profile_id: str) -> LlmProfileDeleteResponse:
    db = get_db(request)
    existing = await q.fetch_profile_row(db, profile_id)
    if existing is None:
        raise http_error(404, "LLM profile not found", error_code=NOT_FOUND)
    in_use = await q.count_tasks_using_profile(db, profile_id)
    if in_use:
        raise http_error(
            409,
            f"LLM profile is referenced by {in_use} task(s)",
            error_code=VALIDATION_ERROR,
        )
    async with db.transaction() as conn:
        await q.delete_profile(TransactionDb(conn), profile_id)
    await clear_slots_for_profile(db, profile_id)
    _notify_profile(request, profile_id, "deleted")
    return LlmProfileDeleteResponse(ok=True)


@router.post("/profiles/{profile_id}/copy", status_code=201, response_model=LlmProfileResponse)
async def copy_profile(
    request: Request,
    profile_id: str,
    body: LlmProfileCopyBody | None = None,
) -> LlmProfileResponse:
    db = get_db(request)
    existing = await q.fetch_profile_row(db, profile_id)
    if existing is None:
        raise http_error(404, "LLM profile not found", error_code=NOT_FOUND)
    staff = await q.fetch_staff_rows_for_profiles(db, [profile_id])
    staff_classes = [str(s["staff_class"]) for s in staff]
    new_profile_id = new_id()
    now = utc_now_iso()
    name = _clean_name(body.name) if body and body.name else f"{existing['name']} (copy)"
    secret_ciphers = await q.copy_profile_secrets(db, profile_id)
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await q.insert_profile_with_raw_secrets(
            tx,
            profile_id=new_profile_id,
            name=name,
            provider=str(existing["provider"]),
            base_url=str(existing.get("base_url") or ""),
            model=str(existing.get("model") or ""),
            secret_ciphers=secret_ciphers,
            thinking_enabled=int(existing.get("thinking_enabled") or 0),
            json_mode=str(existing.get("json_mode") or "disabled"),
            web_search_enabled=int(existing.get("web_search_enabled") or 0),
            web_search_provider=str(existing.get("web_search_provider") or WEB_SEARCH_PROVIDER_DEFAULT),
            now=now,
        )
        await q.upsert_staff_classes(tx, profile_id=new_profile_id, staff_classes=staff_classes, now=now)
    _notify_profile(request, new_profile_id, "created")
    return await _serialize_profile(db, new_profile_id)


@router.get("/staff-instances", response_model=list[LlmStaffInstanceResponse])
async def list_staff_instances(request: Request) -> list[LlmStaffInstanceResponse]:
    rows = await q.fetch_all_staff_rows(get_db(request))
    return [LlmStaffInstanceResponse.model_validate(serialize_llm_staff_instance(row)) for row in rows]


@router.get("/global-slots", response_model=LlmGlobalSlotsResponse)
async def get_global_slots(request: Request) -> LlmGlobalSlotsResponse:
    """Singleton bindings: assistant, A2A (liaison), task advisor (taskEditor)."""
    return await _serialize_global_slots(get_db(request))


@router.put("/global-slots/{slot}", response_model=LlmGlobalSlotBindingResponse)
async def put_global_slot(
    request: Request,
    slot: str,
    body: LlmGlobalSlotBindBody,
) -> LlmGlobalSlotBindingResponse:
    if not is_global_slot_id(slot):
        raise http_error(404, f"Unknown global slot: {slot}", error_code=NOT_FOUND)
    db = get_db(request)
    profile_id = await set_global_slot(db, slot, body.profileId)  # type: ignore[arg-type]
    row = await q.fetch_profile_row(db, profile_id) if profile_id else None
    binding = serialize_slot_binding(slot, profile_id, row)  # type: ignore[arg-type]
    return LlmGlobalSlotBindingResponse.model_validate(binding)


__all__ = ["router"]
