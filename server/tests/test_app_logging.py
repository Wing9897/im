"""Tests for server.app_logging."""

from __future__ import annotations

import json

import pytest

from server.analyzer.llm_json import LlmParseError
from server.analyzer.llm_providers import LlmClientError
from server.app_logging import (
    failure_details_from_exc,
    format_batch_failure_message_en,
    record,
    record_batch_failure,
    summarize_error_message,
)


def test_summarize_error_message_truncates_long_single_line():
    long = "x" * 200
    assert summarize_error_message(long, limit=160).endswith("…")
    assert len(summarize_error_message(long, limit=160)) == 160


def test_summarize_error_message_uses_first_line_only():
    raw = 'LLM request failed with status 429\n{"error": {"code": 429}}'
    assert summarize_error_message(raw) == "LLM request failed with status 429"


def test_format_batch_failure_message_en_is_english_fallback():
    exhausted = format_batch_failure_message_en(
        task_name="Task A",
        batch_id="batch-abcdef12",
        error_message="LLM timeout",
        retries_exhausted=True,
        current_retry=3,
        max_retries=3,
    )
    retrying = format_batch_failure_message_en(
        task_name="Task A",
        batch_id="batch-abcdef12",
        error_message="LLM timeout",
        retries_exhausted=False,
        current_retry=1,
        max_retries=3,
    )
    assert "retries exhausted" in exhausted
    assert "will retry" in retrying
    assert "LLM timeout" in exhausted


@pytest.mark.asyncio
async def test_record_persists_envelope_v1(app):
    db = app.state.db
    log_id = await record(
        db,
        level="info",
        category="system",
        kind="runtime.ai_status",
        message="AI ready",
        message_key="logs:templates.runtimeAiReady",
        message_params={"status": "ready"},
        source="server.test",
        payload={"ok": True},
    )
    row = await db.fetch_one("SELECT * FROM app_logs WHERE id = ?", (log_id,))
    assert row is not None
    assert row["kind"] == "runtime.ai_status"
    details = json.loads(row["details"])
    assert details["v"] == 1
    assert details["messageKey"] == "logs:templates.runtimeAiReady"
    assert details["messageParams"]["status"] == "ready"
    assert details["source"] == "server.test"
    assert details["payload"] == {"ok": True}


@pytest.mark.asyncio
async def test_record_batch_failure_persists_kind_and_envelope(app):
    db = app.state.db
    await record_batch_failure(
        db,
        task_id="task-1",
        task_name="測試任務",
        batch_id="batch-abcdef12",
        error_message="LLM timeout",
        retries_exhausted=True,
        current_retry=3,
        max_retries=3,
    )
    row = await db.fetch_one("SELECT * FROM app_logs ORDER BY time DESC LIMIT 1")
    assert row is not None
    assert row["level"] == "error"
    assert row["category"] == "analysis"
    assert row["kind"] == "batch.failure"
    assert "retries exhausted" in row["message"]

    details = json.loads(row["details"])
    assert details["v"] == 1
    assert details["messageKey"] == "logs:templates.batchExhausted"
    assert details["messageParams"]["taskName"] == "測試任務"
    assert details["messageParams"]["summary"] == "LLM timeout"
    assert details["source"] == "server.scheduler.batch_failure"
    assert details["payload"]["batchId"] == "batch-abcdef12"
    assert details["payload"]["error"] == "LLM timeout"


def test_failure_details_from_exc_http_429():
    body = '{"error":{"message":"Rate limit exceeded","type":"rate_limit_error"}}'
    exc = LlmClientError(
        "LLM request failed with status 429: rate limited",
        status_code=429,
        response_body=body,
        provider="openai",
    )
    details = failure_details_from_exc(exc)
    assert details["failureKind"] == "http"
    assert details["httpStatus"] == 429
    assert details["responseBody"] == body
    assert details["provider"] == "openai"
    assert "429" in details["error"]


def test_failure_details_from_exc_parse():
    raw = '{"items": [{"title": "broken"' + (" x" * 3000)
    exc = LlmParseError("Failed to parse LLM response as JSON: " + raw[:200], raw_response=raw)
    details = failure_details_from_exc(exc)
    assert details["failureKind"] == "parse"
    assert details["responseBody"].startswith('{"items"')
    assert len(details["responseBody"]) <= 4000


def test_failure_details_from_exc_timeout():
    details = failure_details_from_exc(TimeoutError("timed out"))
    assert details["failureKind"] == "timeout"


@pytest.mark.asyncio
async def test_record_batch_failure_merges_http_forensics(app):
    db = app.state.db
    body = '{"error":{"code":429,"message":"Too Many Requests"}}'
    await record_batch_failure(
        db,
        task_id="task-1",
        task_name="AI Task",
        batch_id="batch-429fail1",
        error_message="LLM request failed with status 429: Too Many Requests",
        retries_exhausted=False,
        current_retry=1,
        max_retries=3,
        failure_details={
            "failureKind": "http",
            "httpStatus": 429,
            "responseBody": body,
            "error": "should not overwrite owned error",
        },
    )
    row = await db.fetch_one("SELECT * FROM app_logs ORDER BY time DESC LIMIT 1")
    assert row is not None
    assert row["kind"] == "batch.failure"
    details = json.loads(row["details"])
    assert details["messageKey"] == "logs:templates.batchRetrying"
    assert details["payload"]["failureKind"] == "http"
    assert details["payload"]["httpStatus"] == 429
    assert details["payload"]["responseBody"] == body
    assert details["payload"]["error"].startswith("LLM request failed with status 429")


@pytest.mark.asyncio
async def test_record_batch_failure_redacts_secrets_in_body(app):
    db = app.state.db
    await record_batch_failure(
        db,
        task_id="task-1",
        task_name="AI Task",
        batch_id="batch-secret01",
        error_message="LLM request failed with status 401",
        retries_exhausted=True,
        current_retry=3,
        max_retries=3,
        failure_details={
            "failureKind": "http",
            "httpStatus": 401,
            "responseBody": "api_key=sk-abcdefghijklmnop Bearer secret-token",
        },
    )
    row = await db.fetch_one("SELECT * FROM app_logs ORDER BY time DESC LIMIT 1")
    details = json.loads(row["details"])
    body = details["payload"]["responseBody"]
    assert "sk-abcdefghijklmnop" not in body
    assert "secret-token" not in body
    assert "[REDACTED]" in body


@pytest.mark.asyncio
async def test_record_analysis_trace_kind(app):
    db = app.state.db
    await record(
        db,
        level="info",
        category="analysis",
        kind="analysis.trace",
        message="Analysis trace: Task (batch-01)",
        message_key="logs:templates.analysisTrace",
        source="server.scheduler.batch",
        payload={"batchId": "batch-01"},
    )
    row = await db.fetch_one("SELECT * FROM app_logs WHERE kind = 'analysis.trace' LIMIT 1")
    assert row is not None
    details = json.loads(row["details"])
    assert details["v"] == 1
    assert details["messageKey"] == "logs:templates.analysisTrace"


@pytest.mark.asyncio
async def test_set_analysis_paused_records_app_log_once(app):
    from server.analysis_control import set_analysis_paused

    db = app.state.db
    await set_analysis_paused(db, None, paused=True)
    await set_analysis_paused(db, None, paused=True)  # no-op when already paused
    rows = await db.fetch_all("SELECT * FROM app_logs WHERE kind = 'scheduler.paused'")
    assert len(rows) == 1
    details = json.loads(rows[0]["details"])
    assert details["messageKey"] == "logs:templates.schedulerPaused"

    await set_analysis_paused(db, None, paused=False)
    resumed = await db.fetch_all("SELECT * FROM app_logs WHERE kind = 'scheduler.resumed'")
    assert len(resumed) == 1
    assert json.loads(resumed[0]["details"])["messageKey"] == "logs:templates.schedulerResumed"


@pytest.mark.asyncio
async def test_set_account_error_records_account_category(app):
    from server.account_status import set_account_error
    from server.tests import seed

    db = app.state.db
    await set_account_error(db, seed.RSS_ACCOUNT, "token revoked")
    row = await db.fetch_one("SELECT * FROM app_logs WHERE kind = 'account.error' LIMIT 1")
    assert row is not None
    assert row["category"] == "account"
    details = json.loads(row["details"])
    assert details["messageKey"] == "logs:templates.accountError"
    assert details["payload"]["accountId"] == seed.RSS_ACCOUNT
