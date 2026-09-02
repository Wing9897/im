"""Action executor: dispatch by action_type, record trigger history,
auto-trigger on analysis completion."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from server.action_config import action_configuration_for_execution
from server.actions.handlers import (
    close_shared_session,
    send_discord_webhook,
    send_http_webhook,
    send_mqtt,
    send_telegram_bot,
)
from server.app_logging import record, summarize_error_message
from server.db.database import Database
from server.domain.action_types import (
    ACTION_TYPE_DISCORD_WEBHOOK,
    ACTION_TYPE_HTTP_WEBHOOK,
    ACTION_TYPE_MQTT,
    ACTION_TYPE_TELEGRAM_BOT,
)
from server.util import new_id, parse_json_dict, utc_now_iso

logger = logging.getLogger(__name__)

_ActionHandler = Callable[[dict[str, Any], str, dict[str, Any] | None], Awaitable[dict[str, Any]]]


async def _run_telegram_bot(config: dict[str, Any], message: str, _raw: dict[str, Any] | None) -> dict[str, Any]:
    return await send_telegram_bot(config, message)


async def _run_discord_webhook(config: dict[str, Any], message: str, _raw: dict[str, Any] | None) -> dict[str, Any]:
    return await send_discord_webhook(config, message)


async def _run_http_webhook(config: dict[str, Any], message: str, raw: dict[str, Any] | None) -> dict[str, Any]:
    return await send_http_webhook(config, message, raw)


async def _run_mqtt(config: dict[str, Any], message: str, _raw: dict[str, Any] | None) -> dict[str, Any]:
    return await send_mqtt(config, message)


#: Registry keyed by the ``action_type`` domain vocabulary (drift-tested
#: against ``server.domain.action_types.ALL_ACTION_TYPES``).
ACTION_HANDLERS: dict[str, _ActionHandler] = {
    ACTION_TYPE_TELEGRAM_BOT: _run_telegram_bot,
    ACTION_TYPE_DISCORD_WEBHOOK: _run_discord_webhook,
    ACTION_TYPE_HTTP_WEBHOOK: _run_http_webhook,
    ACTION_TYPE_MQTT: _run_mqtt,
}


class ActionExecutor:
    """Executes actions and records ``action_trigger_history`` rows."""

    def __init__(self, db: Database) -> None:
        self._db = db

    async def shutdown(self) -> None:
        await close_shared_session()

    # ── execution ───────────────────────────────────────────────────────

    async def execute(
        self,
        action: dict[str, Any],
        message: str,
        *,
        trigger_reason: str,
        task_id: str | None = None,
        batch_id: str | None = None,
        raw_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Send via the action's channel and record history; never raises."""
        action_type = str(action.get("action_type") or "")
        config = action_configuration_for_execution(action.get("configuration"))

        handler = ACTION_HANDLERS.get(action_type)
        try:
            if handler is None:
                result = {"success": False, "error": f"Unknown action type: {action_type}"}
            else:
                result = await handler(config, message, raw_data)
        except Exception as exc:  # noqa: BLE001 — handler bug must not crash callers
            logger.exception("Action execution error (%s)", action_type)
            result = {"success": False, "error": f"Action execution error: {exc}"}

        await self._record_history(
            action_id=str(action.get("id") or ""),
            task_id=task_id,
            batch_id=batch_id,
            trigger_reason=trigger_reason,
            success=bool(result.get("success")),
            error_message=None if result.get("success") else result.get("error"),
        )
        return result

    async def _record_history(
        self,
        *,
        action_id: str,
        task_id: str | None,
        batch_id: str | None,
        trigger_reason: str,
        success: bool,
        error_message: str | None,
    ) -> None:
        if not action_id:
            return
        now = utc_now_iso()
        try:
            await self._db.execute(
                "INSERT INTO action_trigger_history "
                "(id, action_id, task_id, batch_id, trigger_reason, status, "
                "error_message, triggered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    new_id(),
                    action_id,
                    task_id,
                    batch_id,
                    trigger_reason,
                    "success" if success else "failure",
                    error_message,
                    now,
                ),
            )
            await self._db.execute(
                "UPDATE actions SET last_triggered_at = ?, updated_at = ? WHERE id = ?",
                (now, now, action_id),
            )
        except Exception as exc:  # noqa: BLE001 — the action already went out; cannot roll back
            logger.exception("Failed to record action history for %s", action_id)
            await self._record_history_write_failure(action_id, exc)

    async def _record_history_write_failure(self, action_id: str, exc: BaseException) -> None:
        """Surface a lost audit row in Settings→Logs; stdout alone hides it from users."""
        summary = summarize_error_message(str(exc))
        try:
            await record(
                self._db,
                level="error",
                category="system",
                kind="action.history_failed",
                message=f"Action fired but its trigger history row was not saved: {action_id} — {summary}",
                message_key="logs:templates.actionHistoryFailed",
                message_params={"actionId": action_id, "summary": summary},
                source="server.actions",
                payload={"actionId": action_id, "error": str(exc)},
            )
        except Exception:  # noqa: BLE001 — the same database is already failing
            logger.exception("Failed to log the action-history write failure for %s", action_id)

    # ── auto trigger on analysis completion ─────────────────────────────

    async def trigger_for_completion(
        self,
        *,
        task_id: str,
        task_name: str,
        batch_id: str,
        analysis_mode: str,
        findings_count: int,
        max_score: float | None,
    ) -> None:
        """Evaluate every enabled action's trigger_conditions and fire matches.

        Empty batches (``findings_count`` <= 0) never outbound — no value to push.
        Supported condition keys: ``task_id``, ``score_threshold``.
        Omitted/null ``score_threshold`` does not filter; an unparseable value skips.

        """
        if findings_count <= 0:
            return

        try:
            actions = await self._db.fetch_all(
                "SELECT id, name, action_type, configuration, trigger_conditions FROM actions WHERE is_enabled = 1"
            )
        except Exception:  # noqa: BLE001 — triggering must not fail the batch
            logger.exception("Failed to load enabled actions for trigger evaluation")
            return

        message = (
            f"[Intelligence Monitor] 任務「{task_name}」分析完成：{findings_count} 筆新結果（模式：{analysis_mode}）"
        )
        raw_data = {
            "taskId": task_id,
            "taskName": task_name,
            "batchId": batch_id,
            "analysisMode": analysis_mode,
            "findingsCount": findings_count,
        }

        for action in actions:
            conditions = parse_json_dict(action.get("trigger_conditions"))
            condition_task_id = conditions.get("task_id")
            if condition_task_id and condition_task_id != task_id:
                continue
            threshold = conditions.get("score_threshold")
            if threshold is not None:
                try:
                    if max_score is None or float(max_score) < float(threshold):
                        continue
                except (TypeError, ValueError):
                    continue
            await self.execute(
                action,
                message,
                trigger_reason="analysis_completed",
                task_id=task_id,
                batch_id=batch_id,
                raw_data=raw_data,
            )
