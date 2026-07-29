"""Persist structured events to the app_logs table (UI log page)."""

from __future__ import annotations

import json
from typing import Optional

from server.db.database import Database
from server.prompts.locale import normalize_ui_locale
from server.util import new_id, utc_now_iso

_ALLOWED_LEVELS = frozenset({"info", "success", "warning", "error"})
_ALLOWED_CATEGORIES = frozenset({"analysis", "collector", "account", "system", "frontend"})

# UI-facing batch failure lines follow system_config ui_locale.
_BATCH_FAILURE_MESSAGES: dict[str, dict[str, str]] = {
    "zh-Hant": {
        "exhausted": "分析批次重試用盡（{max_retries} 次），待恢復分析後再試：{task_name}（{short_batch}）— {summary}",
        "retrying": "分析批次將重試（{current_retry}/{max_retries}）：{task_name}（{short_batch}）— {summary}",
    },
    "zh-Hans": {
        "exhausted": "分析批次重试用尽（{max_retries} 次），待恢复分析后再试：{task_name}（{short_batch}）— {summary}",
        "retrying": "分析批次将重试（{current_retry}/{max_retries}）：{task_name}（{short_batch}）— {summary}",
    },
    "en": {
        "exhausted": (
            "Analysis batch retries exhausted ({max_retries}); "
            "resume analysis to retry: {task_name} ({short_batch}) — {summary}"
        ),
        "retrying": (
            "Analysis batch will retry ({current_retry}/{max_retries}): {task_name} ({short_batch}) — {summary}"
        ),
    },
}


def summarize_error_message(error_message: str, *, limit: int = 160) -> str:
    """One-line summary for log list rows."""
    line = (error_message or "Unknown error").strip().splitlines()[0].strip()
    if len(line) <= limit:
        return line
    return f"{line[: limit - 1]}…"


def format_batch_failure_message(
    *,
    locale: str | None,
    task_name: str,
    batch_id: str,
    error_message: str,
    retries_exhausted: bool,
    current_retry: int,
    max_retries: int,
) -> str:
    """Localize the user-facing batch failure log line."""
    templates = _BATCH_FAILURE_MESSAGES[normalize_ui_locale(locale)]
    summary = summarize_error_message(error_message)
    short_batch = f"{batch_id[:8]}…" if len(batch_id) > 8 else batch_id
    key = "exhausted" if retries_exhausted else "retrying"
    return templates[key].format(
        max_retries=max_retries,
        current_retry=current_retry,
        task_name=task_name,
        short_batch=short_batch,
        summary=summary,
    )


async def write_app_log(
    db: Database,
    *,
    level: str,
    category: str,
    message: str,
    details: Optional[str] = None,
) -> None:
    if level not in _ALLOWED_LEVELS:
        level = "info"
    if category not in _ALLOWED_CATEGORIES:
        category = "system"
    await db.execute(
        "INSERT INTO app_logs (id, time, level, category, message, details) VALUES (?, ?, ?, ?, ?, ?)",
        (new_id(), utc_now_iso(), level, category, message, details),
    )


async def write_batch_failure_log(
    db: Database,
    *,
    task_id: str,
    task_name: str,
    batch_id: str,
    error_message: str,
    retries_exhausted: bool,
    current_retry: int,
    max_retries: int,
    ui_locale: str | None = None,
) -> None:
    message = format_batch_failure_message(
        locale=ui_locale,
        task_name=task_name,
        batch_id=batch_id,
        error_message=error_message,
        retries_exhausted=retries_exhausted,
        current_retry=current_retry,
        max_retries=max_retries,
    )
    level = "error" if retries_exhausted else "warning"
    summary = summarize_error_message(error_message)
    short_batch = f"{batch_id[:8]}…" if len(batch_id) > 8 else batch_id

    details = json.dumps(
        {
            "taskId": task_id,
            "taskName": task_name,
            "batchId": batch_id,
            "retriesExhausted": retries_exhausted,
            "currentRetry": current_retry,
            "maxRetries": max_retries,
            "error": error_message,
            # Display-time i18n: Logs UI re-resolves with current locale when present.
            "messageKey": ("logs:templates.batchExhausted" if retries_exhausted else "logs:templates.batchRetrying"),
            "messageParams": {
                "taskName": task_name,
                "shortBatch": short_batch,
                "summary": summary,
                "maxRetries": max_retries,
                "currentRetry": current_retry,
            },
        },
        ensure_ascii=False,
    )
    await write_app_log(
        db,
        level=level,
        category="analysis",
        message=message,
        details=details,
    )
