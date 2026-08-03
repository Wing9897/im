"""Persist structured events to the app_logs table (UI log page)."""

from __future__ import annotations

import json
import re
from typing import Any, Optional

from server.db.database import Database
from server.prompts.locale import normalize_ui_locale
from server.util import new_id, utc_now_iso

_ALLOWED_LEVELS = frozenset({"info", "success", "warning", "error"})
_ALLOWED_CATEGORIES = frozenset({"analysis", "collector", "account", "system", "frontend"})

#: Cap for response bodies stored in ``app_logs.details`` (failure forensics).
_RESPONSE_BODY_LOG_CAP = 4000

#: Keys owned by ``write_batch_failure_log``; not overwritten by ``failure_details``.
_BATCH_FAILURE_OWNED_KEYS = frozenset(
    {
        "taskId",
        "taskName",
        "batchId",
        "retriesExhausted",
        "currentRetry",
        "maxRetries",
        "error",
        "messageKey",
        "messageParams",
    }
)

_API_KEY_ASSIGN_RE = re.compile(r"(?i)((?:api[_-]?key)\s*[=:]\s*)(\S+)")
_BEARER_RE = re.compile(r"(?i)\b(bearer\s+)(\S+)")
_SK_TOKEN_RE = re.compile(r"\bsk-[A-Za-z0-9_\-]{8,}\b")

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


def _cap_response_body(text: str, *, limit: int = _RESPONSE_BODY_LOG_CAP) -> str:
    if len(text) <= limit:
        return text
    return text[:limit]


def _redact_secrets(text: str) -> str:
    """Strip common API-key / bearer fragments before persisting log details."""
    redacted = _API_KEY_ASSIGN_RE.sub(r"\1[REDACTED]", text)
    redacted = _BEARER_RE.sub(r"\1[REDACTED]", redacted)
    return _SK_TOKEN_RE.sub("sk-[REDACTED]", redacted)


def failure_details_from_exc(exc: BaseException) -> dict[str, Any]:
    """Build structured failure forensics for Settings→Logs ``details`` JSON."""
    # Local imports avoid app_logging ↔ analyzer import cycles at module load.
    from server.analyzer.llm_json import LlmParseError
    from server.analyzer.llm_providers import LlmClientError

    summary = summarize_error_message(str(exc))
    details: dict[str, Any] = {"error": summary, "failureKind": "other"}

    if isinstance(exc, LlmClientError):
        if exc.status_code is not None:
            details["failureKind"] = "http"
            details["httpStatus"] = int(exc.status_code)
        if exc.response_body:
            details["responseBody"] = _cap_response_body(_redact_secrets(exc.response_body))
        if exc.provider:
            details["provider"] = exc.provider
        return details

    if isinstance(exc, LlmParseError):
        details["failureKind"] = "parse"
        details["responseBody"] = _cap_response_body(_redact_secrets(exc.raw_response))
        return details

    if isinstance(exc, TimeoutError):
        details["failureKind"] = "timeout"
        return details

    return details


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
    failure_details: dict[str, Any] | None = None,
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

    details_obj: dict[str, Any] = {
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
    }
    if failure_details:
        for key, value in failure_details.items():
            if key in _BATCH_FAILURE_OWNED_KEYS:
                continue
            if key in {"responseBody", "responseSnippet"} and isinstance(value, str):
                details_obj[key] = _cap_response_body(_redact_secrets(value))
            else:
                details_obj[key] = value
    details = json.dumps(details_obj, ensure_ascii=False)
    await write_app_log(
        db,
        level=level,
        category="analysis",
        message=message,
        details=details,
    )
