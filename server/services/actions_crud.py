"""CRUD service for automation actions.

HTTP status codes and SSE notify stay in the route. This module owns JSON
validation, masked-secret merge, persistence, and the toggle / manual-test
boundary. Channel execution stays on ``ActionExecutor``.
"""

from __future__ import annotations

import json
from typing import Any

from server.action_config import merge_masked_action_configuration, protect_action_configuration
from server.config import get_config
from server.db.database import Database
from server.prompts.locale import normalize_ui_locale
from server.queries import actions_queries
from server.util import new_id, utc_now_iso
from server.wire.serializers import serialize_action

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


class ActionValidationError(ValueError):
    """Invalid action write, or the target row is missing."""


def _validate_write(*, name: str, configuration: str, trigger_conditions: str | None) -> str:
    """Non-shape checks. ``actionType`` stays a wire Literal (unknown → 422)."""
    cleaned = name.strip()
    if not cleaned:
        raise ActionValidationError("Action name is required")
    try:
        parsed = json.loads(configuration)
        if not isinstance(parsed, dict):
            raise TypeError
    except (json.JSONDecodeError, TypeError) as exc:
        raise ActionValidationError("configuration must be a JSON object string") from exc
    if trigger_conditions:
        try:
            json.loads(trigger_conditions)
        except json.JSONDecodeError as exc:
            raise ActionValidationError("triggerConditions must be valid JSON") from exc
    return cleaned


async def _require_action(db: Database, action_id: str) -> dict[str, Any]:
    row = await actions_queries.fetch_action_row(db, action_id)
    if row is None:
        raise ActionValidationError(f"Action {action_id} not found")
    return row


async def create_action(
    db: Database,
    *,
    name: str,
    action_type: str,
    configuration: str,
    trigger_conditions: str | None,
) -> dict[str, Any]:
    cleaned = _validate_write(
        name=name,
        configuration=configuration,
        trigger_conditions=trigger_conditions,
    )
    action_id = new_id()
    now = utc_now_iso()
    await actions_queries.insert_action(
        db,
        action_id=action_id,
        name=cleaned,
        action_type=action_type,
        configuration=protect_action_configuration(configuration),
        trigger_conditions=trigger_conditions,
        now=now,
    )
    return serialize_action(await _require_action(db, action_id))


async def update_action(
    db: Database,
    action_id: str,
    *,
    name: str,
    action_type: str,
    configuration: str,
    trigger_conditions: str | None,
) -> dict[str, Any]:
    cleaned = _validate_write(
        name=name,
        configuration=configuration,
        trigger_conditions=trigger_conditions,
    )
    existing = await _require_action(db, action_id)
    stored_configuration = configuration
    if action_type == existing.get("action_type"):
        stored_configuration = merge_masked_action_configuration(
            configuration,
            existing.get("configuration"),
            action_type,
        )
    await actions_queries.update_action(
        db,
        action_id=action_id,
        name=cleaned,
        action_type=action_type,
        configuration=protect_action_configuration(stored_configuration),
        trigger_conditions=trigger_conditions,
        now=utc_now_iso(),
    )
    return serialize_action(await _require_action(db, action_id))


async def delete_action(db: Database, action_id: str) -> None:
    await _require_action(db, action_id)
    await actions_queries.delete_action(db, action_id)


async def toggle_action(db: Database, action_id: str) -> dict[str, Any]:
    row = await _require_action(db, action_id)
    new_enabled = 0 if row.get("is_enabled") else 1
    await actions_queries.set_action_enabled(db, action_id, new_enabled, utc_now_iso())
    return {"id": action_id, "isEnabled": bool(new_enabled)}


async def test_action(db: Database, executor: Any, action_id: str) -> dict[str, Any]:
    """Run one manual test. ``executor.execute`` semantics stay on ActionExecutor."""
    row = await _require_action(db, action_id)
    locale = normalize_ui_locale(await get_config(db, "ui_locale"))
    result = await executor.execute(
        row,
        _TEST_MESSAGES[locale],
        trigger_reason="manual_test",
    )
    if result.get("success"):
        return {"success": True}
    return {"success": False, "error": result.get("error") or _UNKNOWN_ERRORS[locale]}
