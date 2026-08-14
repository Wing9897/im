"""Persist structured events to the app_logs table (UI log page).

All Settings→Logs writes go through :func:`record`. Stdlib loggers stay on
stdout only.
"""

from __future__ import annotations

import json
import re
from typing import Any

from server.db.database import Database
from server.domain.app_log_categories import ALLOWED_APP_LOG_CATEGORIES
from server.domain.app_log_levels import ALLOWED_APP_LOG_LEVELS as _ALLOWED_LEVELS
from server.queries.logs_queries import fetch_app_log
from server.util import new_id, utc_now_iso

ALLOWED_LOG_CATEGORIES = ALLOWED_APP_LOG_CATEGORIES
_ALLOWED_CATEGORIES = ALLOWED_LOG_CATEGORIES

#: Cap for response bodies stored in envelope ``payload`` (failure forensics).
_RESPONSE_BODY_LOG_CAP = 4000

#: Keys owned by batch.failure composition; not overwritten by ``failure_details``.
_BATCH_FAILURE_OWNED_KEYS = frozenset(
    {
        "taskId",
        "taskName",
        "batchId",
        "retriesExhausted",
        "currentRetry",
        "maxRetries",
        "error",
    }
)

_API_KEY_ASSIGN_RE = re.compile(r"(?i)((?:api[_-]?key)\s*[=:]\s*)(\S+)")
_BEARER_RE = re.compile(r"(?i)\b(bearer\s+)(\S+)")
_SK_TOKEN_RE = re.compile(r"\bsk-[A-Za-z0-9_\-]{8,}\b")

_KIND_RE = re.compile(r"^[a-z][a-z0-9._-]{0,63}$")

_BATCH_FAILURE_MESSAGE_EN = {
    "exhausted": (
        "Analysis batch retries exhausted ({max_retries}); "
        "resume analysis to retry: {task_name} ({short_batch}) — {summary}"
    ),
    "retrying": ("Analysis batch will retry ({current_retry}/{max_retries}): {task_name} ({short_batch}) — {summary}"),
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


def _sanitize_payload(payload: dict[str, Any] | None) -> dict[str, Any]:
    if not payload:
        return {}
    out: dict[str, Any] = {}
    for key, value in payload.items():
        if key in {"responseBody", "responseSnippet"} and isinstance(value, str):
            out[key] = _cap_response_body(_redact_secrets(value))
        else:
            out[key] = value
    return out


def normalize_log_level(level: str) -> str:
    return level if level in _ALLOWED_LEVELS else "info"


def normalize_log_category(category: str) -> str:
    return category if category in _ALLOWED_CATEGORIES else "system"


def is_valid_log_kind(kind: str) -> bool:
    return bool(kind and _KIND_RE.fullmatch(kind))


def failure_details_from_exc(exc: BaseException) -> dict[str, Any]:
    """Build structured failure forensics for Settings→Logs ``payload``."""
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


def format_batch_failure_message_en(
    *,
    task_name: str,
    batch_id: str,
    error_message: str,
    retries_exhausted: bool,
    current_retry: int,
    max_retries: int,
) -> str:
    """English fallback line for ``app_logs.message`` (FE re-resolves via messageKey)."""
    summary = summarize_error_message(error_message)
    short_batch = f"{batch_id[:8]}…" if len(batch_id) > 8 else batch_id
    key = "exhausted" if retries_exhausted else "retrying"
    return _BATCH_FAILURE_MESSAGE_EN[key].format(
        max_retries=max_retries,
        current_retry=current_retry,
        task_name=task_name,
        short_batch=short_batch,
        summary=summary,
    )


def _build_envelope(
    *,
    message_key: str | None,
    message_params: dict[str, Any] | None,
    source: str | None,
    payload: dict[str, Any] | None,
) -> str:
    return json.dumps(
        {
            "v": 1,
            "messageKey": message_key,
            "messageParams": message_params or {},
            "source": source,
            "payload": _sanitize_payload(payload),
        },
        ensure_ascii=False,
    )


async def record(
    db: Database,
    *,
    level: str,
    category: str,
    kind: str,
    message: str | None = None,
    message_key: str | None = None,
    message_params: dict[str, Any] | None = None,
    source: str | None = None,
    payload: dict[str, Any] | None = None,
) -> str:
    """Insert one app log row. Returns the new row id.

    ``details`` is always envelope v1 JSON. ``message`` is an English (or
    caller-provided) fallback for search / older clients; FE prefers
    ``messageKey`` when present.
    """
    level = normalize_log_level(level)
    category = normalize_log_category(category)
    if not is_valid_log_kind(kind):
        kind = "system"
    resolved_message = (message or "").strip() or message_key or kind
    log_id = new_id()
    await db.execute(
        "INSERT INTO app_logs (id, time, level, category, kind, message, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            log_id,
            utc_now_iso(),
            level,
            category,
            kind,
            resolved_message,
            _build_envelope(
                message_key=message_key,
                message_params=message_params,
                source=source,
                payload=payload,
            ),
        ),
    )
    return log_id


async def record_and_fetch(
    db: Database,
    *,
    level: str,
    category: str,
    kind: str,
    message: str | None = None,
    message_key: str | None = None,
    message_params: dict[str, Any] | None = None,
    source: str | None = None,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Like :func:`record`, then return the persisted row (HTTP POST)."""
    log_id = await record(
        db,
        level=level,
        category=category,
        kind=kind,
        message=message,
        message_key=message_key,
        message_params=message_params,
        source=source,
        payload=payload,
    )
    row = await fetch_app_log(db, log_id)
    assert row is not None
    return row


async def clear_app_logs(db: Database) -> None:
    await db.execute("DELETE FROM app_logs")


async def record_batch_failure(
    db: Database,
    *,
    task_id: str,
    task_name: str,
    batch_id: str,
    error_message: str,
    retries_exhausted: bool,
    current_retry: int,
    max_retries: int,
    failure_details: dict[str, Any] | None = None,
) -> str:
    """Compose a ``batch.failure`` event and persist via :func:`record`."""
    summary = summarize_error_message(error_message)
    short_batch = f"{batch_id[:8]}…" if len(batch_id) > 8 else batch_id
    message_key = "logs:templates.batchExhausted" if retries_exhausted else "logs:templates.batchRetrying"
    message_params = {
        "taskName": task_name,
        "shortBatch": short_batch,
        "summary": summary,
        "maxRetries": max_retries,
        "currentRetry": current_retry,
    }
    payload: dict[str, Any] = {
        "taskId": task_id,
        "taskName": task_name,
        "batchId": batch_id,
        "retriesExhausted": retries_exhausted,
        "currentRetry": current_retry,
        "maxRetries": max_retries,
        "error": error_message,
    }
    if failure_details:
        for key, value in failure_details.items():
            if key in _BATCH_FAILURE_OWNED_KEYS:
                continue
            payload[key] = value
    return await record(
        db,
        level="error" if retries_exhausted else "warning",
        category="analysis",
        kind="batch.failure",
        message=format_batch_failure_message_en(
            task_name=task_name,
            batch_id=batch_id,
            error_message=error_message,
            retries_exhausted=retries_exhausted,
            current_retry=current_retry,
            max_retries=max_retries,
        ),
        message_key=message_key,
        message_params=message_params,
        source="server.scheduler.batch_failure",
        payload=payload,
    )
