"""Action executor: dispatch by action_type, record trigger history,
auto-trigger on analysis completion."""

from __future__ import annotations

import logging
from typing import Any

from server.action_config import action_configuration_for_execution
from server.actions.handlers import (
    close_shared_session,
    send_discord_webhook,
    send_http_webhook,
    send_mqtt,
    send_telegram_bot,
)
from server.db.database import Database
from server.util import new_id, parse_json_dict, utc_now_iso

logger = logging.getLogger(__name__)


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

        try:
            if action_type == "telegram_bot":
                result = await send_telegram_bot(config, message)
            elif action_type == "discord_webhook":
                result = await send_discord_webhook(config, message)
            elif action_type == "http_webhook":
                result = await send_http_webhook(config, message, raw_data)
            elif action_type == "mqtt":
                result = await send_mqtt(config, message)
            else:
                result = {"success": False, "error": f"Unknown action type: {action_type}"}
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
        except Exception:  # noqa: BLE001 — history is best-effort
            logger.exception("Failed to record action history for %s", action_id)

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
                    pass
            await self.execute(
                action,
                message,
                trigger_reason="analysis_completed",
                task_id=task_id,
                batch_id=batch_id,
                raw_data=raw_data,
            )
