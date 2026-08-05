"""Actions routes: CRUD, toggle, manual test."""

from __future__ import annotations

import json
from typing import Any, Optional

from fastapi import APIRouter, Request, Response

from server.action_config import (
    merge_masked_action_configuration,
    protect_action_configuration,
)
from server.api.deps import (
    API_DEPS,
    get_action_executor,
    get_db,
    publish_resource_modified,
    require_row,
)
from server.api.schemas.requests import ActionBody
from server.api.schemas.responses import (
    ActionResponse,
    ActionTestResponse,
    ActionToggleResponse,
    ActionTriggerHistoryPageResponse,
)
from server.config import get_config
from server.errors import VALIDATION_ERROR, http_error
from server.prompts.locale import normalize_ui_locale
from server.queries import actions_queries
from server.util import new_id, utc_now_iso
from server.wire.serializers import serialize_action, serialize_action_trigger_history

router = APIRouter(prefix="/api/v1/actions", tags=["actions"], dependencies=API_DEPS)

_ALLOWED_TYPES = ("telegram_bot", "discord_webhook", "http_webhook", "mqtt")

_TEST_MESSAGES: dict[str, str] = {
    "zh-Hant": "[Intelligence Monitor] 測試訊息：動作設定運作正常。",
    "zh-Hans": "[Intelligence Monitor] 测试消息：动作设置工作正常。",
    "en": "[Intelligence Monitor] Test message: action settings are working.",
}

_UNKNOWN_ERRORS: dict[str, str] = {
    "zh-Hant": "未知錯誤",
    "zh-Hans": "未知错误",
    "en": "Unknown error",
}


def _validate_body(body: ActionBody) -> None:
    if not body.name.strip():
        raise http_error(422, "Action name is required", error_code=VALIDATION_ERROR)
    if body.actionType not in _ALLOWED_TYPES:
        raise http_error(
            422,
            f"Invalid actionType: {body.actionType}",
            error_code=VALIDATION_ERROR,
        )
    try:
        parsed = json.loads(body.configuration)
        if not isinstance(parsed, dict):
            raise ValueError
    except (json.JSONDecodeError, ValueError) as exc:
        raise http_error(
            422,
            "configuration must be a JSON object string",
            error_code=VALIDATION_ERROR,
        ) from exc
    if body.triggerConditions:
        try:
            json.loads(body.triggerConditions)
        except json.JSONDecodeError as exc:
            raise http_error(
                422,
                "triggerConditions must be valid JSON",
                error_code=VALIDATION_ERROR,
            ) from exc


async def _get_action_row(db: Any, action_id: str) -> dict[str, Any]:
    return await require_row(db, "actions", "Action", action_id)


def _notify(request: Request, action_id: str, action: str) -> None:
    publish_resource_modified(request, "action", action_id, action)


# ── CRUD ─────────────────────────────────────────────────────────────────


@router.get("", response_model=list[ActionResponse])
async def list_actions(request: Request) -> list[dict]:
    db = get_db(request)
    rows = await actions_queries.fetch_all_action_rows(db)
    return [serialize_action(row) for row in rows]


@router.get("/trigger-history", response_model=ActionTriggerHistoryPageResponse)
async def list_trigger_history(
    request: Request,
    action_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    db = get_db(request)
    rows, total_count, has_more = await actions_queries.fetch_trigger_history_page(
        db,
        action_id=action_id,
        limit=limit,
        offset=offset,
    )
    items = [serialize_action_trigger_history(row) for row in rows]
    return {
        "items": items,
        "totalCount": total_count,
        "hasMore": has_more,
    }


@router.post("", status_code=201, response_model=ActionResponse)
async def create_action(request: Request, body: ActionBody) -> dict:
    _validate_body(body)
    db = get_db(request)
    action_id = new_id()
    now = utc_now_iso()
    await actions_queries.insert_action(
        db,
        action_id=action_id,
        name=body.name.strip(),
        action_type=body.actionType,
        configuration=protect_action_configuration(body.configuration),
        trigger_conditions=body.triggerConditions,
        now=now,
    )
    _notify(request, action_id, "created")
    return serialize_action(await _get_action_row(db, action_id))


@router.put("/{action_id}", response_model=ActionResponse)
async def update_action(request: Request, action_id: str, body: ActionBody) -> dict:
    _validate_body(body)
    db = get_db(request)
    existing = await _get_action_row(db, action_id)
    configuration = body.configuration
    if body.actionType == existing.get("action_type"):
        configuration = merge_masked_action_configuration(
            configuration,
            existing.get("configuration"),
            body.actionType,
        )
    await actions_queries.update_action(
        db,
        action_id=action_id,
        name=body.name.strip(),
        action_type=body.actionType,
        configuration=protect_action_configuration(configuration),
        trigger_conditions=body.triggerConditions,
        now=utc_now_iso(),
    )
    _notify(request, action_id, "updated")
    return serialize_action(await _get_action_row(db, action_id))


@router.delete("/{action_id}", status_code=204)
async def delete_action(request: Request, action_id: str) -> Response:
    db = get_db(request)
    await _get_action_row(db, action_id)
    await actions_queries.delete_action(db, action_id)
    _notify(request, action_id, "deleted")
    return Response(status_code=204)


@router.patch("/{action_id}/toggle", response_model=ActionToggleResponse)
async def toggle_action(request: Request, action_id: str) -> dict:
    db = get_db(request)
    row = await _get_action_row(db, action_id)
    new_enabled = 0 if row.get("is_enabled") else 1
    await actions_queries.set_action_enabled(db, action_id, new_enabled, utc_now_iso())
    _notify(request, action_id, "updated")
    return {"id": action_id, "isEnabled": bool(new_enabled)}


@router.post(
    "/{action_id}/test",
    response_model=ActionTestResponse,
    response_model_exclude_none=True,
)
async def test_action(request: Request, action_id: str) -> dict:
    db = get_db(request)
    row = await _get_action_row(db, action_id)
    locale = normalize_ui_locale(await get_config(db, "ui_locale"))
    executor = get_action_executor(request)
    result = await executor.execute(
        row,
        _TEST_MESSAGES[locale],
        trigger_reason="manual_test",
    )
    if result.get("success"):
        return {"success": True}
    return {
        "success": False,
        "error": result.get("error") or _UNKNOWN_ERRORS[locale],
    }
