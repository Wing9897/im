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
from server.errors import FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, http_error
from server.llm_global_slots import (
    LLM_GLOBAL_SLOTS,
    clear_slots_for_profile,
    is_global_slot_id,
    list_global_slots,
    serialize_slot_binding,
    set_global_slot,
)
from server.llm_profiles_const import DEFAULT_LLM_PROFILE_ID, LLM_STAFF_CLASSES, LLM_TASK_STAFF_CLASSES
from server.queries import llm_profiles_queries as q
from server.secrets import MASKED_SECRET
from server.util import new_id, utc_now_iso
from server.wire.serializer_domains.llm_profiles import (
    serialize_llm_profile,
    serialize_llm_staff_instance,
)

router = APIRouter(prefix="/api/v1/llm", tags=["llm"], dependencies=API_DEPS)

_WEB_SEARCH_PROVIDERS = frozenset({"auto", "duckduckgo", "brave"})


def _notify_profile(request: Request, profile_id: str, action: str) -> None:
    publish_resource_modified(request, "llm_profile", profile_id, action)


def _clean_name(name: str) -> str:
    cleaned = name.strip()
    if not cleaned:
        raise http_error(422, "Profile name is required", error_code=VALIDATION_ERROR)
    return cleaned


def _normalize_staff_classes(raw: list[str] | None) -> list[str]:
    """Normalize task-mode staff classes; ``assistant`` is ignored (global slot)."""
    if not raw:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        value = str(item).strip()
        if value == "assistant":
            # Global singleton — bind via /llm/global-slots/assistant.
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


async def _serialize_global_slots(db: Any) -> dict[str, Any]:
    bindings = await list_global_slots(db)
    slots: list[dict[str, Any]] = []
    for slot in LLM_GLOBAL_SLOTS:
        profile_id = bindings.get(slot)
        row = await q.fetch_profile_row(db, profile_id) if profile_id else None
        if profile_id and row is None:
            profile_id = None
        slots.append(serialize_slot_binding(slot, profile_id, row))
    return {"slots": slots}


def _normalize_web_search_provider(raw: str | None) -> str:
    value = (raw or "auto").strip().lower()
    return value if value in _WEB_SEARCH_PROVIDERS else "auto"


async def _serialize_profile(db: Any, profile_id: str) -> dict[str, Any]:
    row = await require_row(db, "llm_profiles", "LLM profile", profile_id)
    staff = await q.fetch_staff_rows_for_profiles(db, [profile_id])
    return serialize_llm_profile(row, staff)


@router.get("/profiles", response_model=list[LlmProfileResponse])
async def list_profiles(request: Request) -> list[dict[str, Any]]:
    db = get_db(request)
    rows = await q.fetch_all_profile_rows(db)
    staff = await q.fetch_staff_rows_for_profiles(db, [str(r["id"]) for r in rows])
    by_profile: dict[str, list[dict[str, Any]]] = {}
    for item in staff:
        by_profile.setdefault(str(item["profile_id"]), []).append(item)
    return [serialize_llm_profile(row, by_profile.get(str(row["id"]), [])) for row in rows]


@router.post("/profiles", status_code=201, response_model=LlmProfileResponse)
async def create_profile(request: Request, body: LlmProfileUpsertBody) -> dict[str, Any]:
    name = _clean_name(body.name)
    staff_classes = _normalize_staff_classes(list(body.staffClasses))
    profile_id = new_id()
    now = utc_now_iso()
    db = get_db(request)
    existing_count = await q.count_profiles(db)
    # First profile always becomes default; otherwise honor explicit isDefault.
    make_default = existing_count == 0 or bool(body.isDefault)
    api_key = "" if body.apiKey in (None, MASKED_SECRET) else str(body.apiKey)
    brave_key = "" if body.braveSearchApiKey in (None, MASKED_SECRET) else str(body.braveSearchApiKey)
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        if make_default:
            await q.clear_default_flags(tx)
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
            web_search_provider=_normalize_web_search_provider(body.webSearchProvider),
            brave_search_api_key=brave_key,
            is_default=1 if make_default else 0,
            now=now,
        )
        await q.upsert_staff_classes(tx, profile_id=profile_id, staff_classes=staff_classes, now=now)
    _notify_profile(request, profile_id, "created")
    return await _serialize_profile(db, profile_id)


@router.get("/profiles/{profile_id}", response_model=LlmProfileResponse)
async def get_profile(request: Request, profile_id: str) -> dict[str, Any]:
    return await _serialize_profile(get_db(request), profile_id)


@router.patch("/profiles/{profile_id}", response_model=LlmProfileResponse)
async def patch_profile(request: Request, profile_id: str, body: LlmProfileUpsertBody) -> dict[str, Any]:
    db = get_db(request)
    existing = await q.fetch_profile_row(db, profile_id)
    if existing is None:
        raise http_error(404, "LLM profile not found", error_code=NOT_FOUND)
    name = _clean_name(body.name)
    staff_classes = _normalize_staff_classes(list(body.staffClasses))
    now = utc_now_iso()
    api_key: str | None
    if body.apiKey is None or body.apiKey == MASKED_SECRET:
        api_key = None
    else:
        api_key = str(body.apiKey)
    brave_key: str | None
    if body.braveSearchApiKey is None or body.braveSearchApiKey == MASKED_SECRET:
        brave_key = None
    else:
        brave_key = str(body.braveSearchApiKey)
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        if body.isDefault is True:
            await q.set_default_profile(tx, profile_id, now=now)
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
            web_search_provider=_normalize_web_search_provider(body.webSearchProvider),
            brave_search_api_key=brave_key,
            now=now,
        )
        await q.upsert_staff_classes(tx, profile_id=profile_id, staff_classes=staff_classes, now=now)
    _notify_profile(request, profile_id, "updated")
    return await _serialize_profile(db, profile_id)


@router.delete("/profiles/{profile_id}", response_model=LlmProfileDeleteResponse)
async def delete_profile(request: Request, profile_id: str) -> dict[str, bool]:
    db = get_db(request)
    existing = await q.fetch_profile_row(db, profile_id)
    if existing is None:
        raise http_error(404, "LLM profile not found", error_code=NOT_FOUND)
    profile_count = await q.count_profiles(db)
    # Allow deleting the last profile (empty table = no default). Otherwise the
    # current default must be reassigned before delete.
    if bool(int(existing.get("is_default") or 0)) and profile_count > 1:
        raise http_error(
            403,
            "Set another profile as default before deleting this one",
            error_code=FORBIDDEN,
        )
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
    return {"ok": True}


@router.post("/profiles/{profile_id}/copy", status_code=201, response_model=LlmProfileResponse)
async def copy_profile(
    request: Request,
    profile_id: str,
    body: LlmProfileCopyBody | None = None,
) -> dict[str, Any]:
    db = get_db(request)
    existing = await q.fetch_profile_row(db, profile_id)
    if existing is None:
        raise http_error(404, "LLM profile not found", error_code=NOT_FOUND)
    staff = await q.fetch_staff_rows_for_profiles(db, [profile_id])
    staff_classes = [str(s["staff_class"]) for s in staff]
    new_profile_id = new_id()
    now = utc_now_iso()
    name = _clean_name(body.name) if body and body.name else f"{existing['name']} (copy)"
    api_cipher, brave_cipher = await q.copy_profile_secrets(db, profile_id)
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await q.insert_profile_with_raw_secrets(
            tx,
            profile_id=new_profile_id,
            name=name,
            provider=str(existing["provider"]),
            base_url=str(existing.get("base_url") or ""),
            model=str(existing.get("model") or ""),
            api_key_cipher=api_cipher,
            thinking_enabled=int(existing.get("thinking_enabled") or 0),
            json_mode=str(existing.get("json_mode") or "disabled"),
            web_search_enabled=int(existing.get("web_search_enabled") or 0),
            web_search_provider=str(existing.get("web_search_provider") or "auto"),
            brave_search_api_key_cipher=brave_cipher,
            is_default=0,
            now=now,
        )
        await q.upsert_staff_classes(tx, profile_id=new_profile_id, staff_classes=staff_classes, now=now)
    _notify_profile(request, new_profile_id, "created")
    return await _serialize_profile(db, new_profile_id)


@router.post("/profiles/{profile_id}/set-default", response_model=LlmProfileResponse)
async def set_default_profile(request: Request, profile_id: str) -> dict[str, Any]:
    db = get_db(request)
    existing = await q.fetch_profile_row(db, profile_id)
    if existing is None:
        raise http_error(404, "LLM profile not found", error_code=NOT_FOUND)
    now = utc_now_iso()
    async with db.transaction() as conn:
        await q.set_default_profile(TransactionDb(conn), profile_id, now=now)
    _notify_profile(request, profile_id, "updated")
    return await _serialize_profile(db, profile_id)


@router.get("/staff-instances", response_model=list[LlmStaffInstanceResponse])
async def list_staff_instances(request: Request) -> list[dict[str, Any]]:
    rows = await q.fetch_all_staff_rows(get_db(request))
    return [serialize_llm_staff_instance(row) for row in rows]


@router.get("/global-slots", response_model=LlmGlobalSlotsResponse)
async def get_global_slots(request: Request) -> dict[str, Any]:
    """Singleton bindings: assistant, A2A (liaison), task advisor (taskEditor)."""
    return await _serialize_global_slots(get_db(request))


@router.put("/global-slots/{slot}", response_model=LlmGlobalSlotBindingResponse)
async def put_global_slot(
    request: Request,
    slot: str,
    body: LlmGlobalSlotBindBody,
) -> dict[str, Any]:
    if not is_global_slot_id(slot):
        raise http_error(404, f"Unknown global slot: {slot}", error_code=NOT_FOUND)
    db = get_db(request)
    profile_id = await set_global_slot(db, slot, body.profileId)  # type: ignore[arg-type]
    row = await q.fetch_profile_row(db, profile_id) if profile_id else None
    return serialize_slot_binding(slot, profile_id, row)  # type: ignore[arg-type]


__all__ = ["DEFAULT_LLM_PROFILE_ID", "router"]
