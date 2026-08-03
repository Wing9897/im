"""Tests for server.app_logging."""

from __future__ import annotations

import json

import pytest

from server.analyzer.llm_json import LlmParseError
from server.analyzer.llm_providers import LlmClientError
from server.app_logging import (
    failure_details_from_exc,
    format_batch_failure_message,
    summarize_error_message,
    write_batch_failure_log,
)


def test_summarize_error_message_truncates_long_single_line():
    long = "x" * 200
    assert summarize_error_message(long, limit=160).endswith("…")
    assert len(summarize_error_message(long, limit=160)) == 160


def test_summarize_error_message_uses_first_line_only():
    raw = 'LLM request failed with status 429\n{"error": {"code": 429}}'
    assert summarize_error_message(raw) == "LLM request failed with status 429"


def test_format_batch_failure_message_follows_ui_locale():
    zh = format_batch_failure_message(
        locale="zh-Hant",
        task_name="Task A",
        batch_id="batch-abcdef12",
        error_message="LLM timeout",
        retries_exhausted=True,
        current_retry=3,
        max_retries=3,
    )
    en = format_batch_failure_message(
        locale="en",
        task_name="Task A",
        batch_id="batch-abcdef12",
        error_message="LLM timeout",
        retries_exhausted=True,
        current_retry=3,
        max_retries=3,
    )
    assert "重試用盡" in zh
    assert "retries exhausted" in en
    assert "LLM timeout" in en


@pytest.mark.asyncio
async def test_write_batch_failure_log_persists_details(app):
    db = app.state.db
    await write_batch_failure_log(
        db,
        task_id="task-1",
        task_name="測試任務",
        batch_id="batch-abcdef12",
        error_message="LLM timeout",
        retries_exhausted=True,
        current_retry=3,
        max_retries=3,
        ui_locale="zh-Hant",
    )
    row = await db.fetch_one("SELECT * FROM app_logs ORDER BY time DESC LIMIT 1")
    assert row is not None
    assert row["level"] == "error"
    assert row["category"] == "analysis"
    assert "重試用盡" in row["message"]
    assert "LLM timeout" in row["details"]

    details = json.loads(row["details"])
    assert details["messageKey"] == "logs:templates.batchExhausted"
    assert details["messageParams"]["taskName"] == "測試任務"
    assert details["messageParams"]["summary"] == "LLM timeout"


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
async def test_write_batch_failure_log_merges_http_forensics(app):
    db = app.state.db
    body = '{"error":{"code":429,"message":"Too Many Requests"}}'
    await write_batch_failure_log(
        db,
        task_id="task-1",
        task_name="AI Task",
        batch_id="batch-429fail1",
        error_message="LLM request failed with status 429: Too Many Requests",
        retries_exhausted=False,
        current_retry=1,
        max_retries=3,
        ui_locale="en",
        failure_details={
            "failureKind": "http",
            "httpStatus": 429,
            "responseBody": body,
            "error": "should not overwrite owned error",
        },
    )
    row = await db.fetch_one("SELECT * FROM app_logs ORDER BY time DESC LIMIT 1")
    assert row is not None
    details = json.loads(row["details"])
    assert details["failureKind"] == "http"
    assert details["httpStatus"] == 429
    assert details["responseBody"] == body
    assert details["error"].startswith("LLM request failed with status 429")
    assert details["messageKey"] == "logs:templates.batchRetrying"


@pytest.mark.asyncio
async def test_write_batch_failure_log_redacts_secrets_in_body(app):
    db = app.state.db
    await write_batch_failure_log(
        db,
        task_id="task-1",
        task_name="AI Task",
        batch_id="batch-secret01",
        error_message="LLM request failed with status 401",
        retries_exhausted=True,
        current_retry=3,
        max_retries=3,
        ui_locale="en",
        failure_details={
            "failureKind": "http",
            "httpStatus": 401,
            "responseBody": "api_key=sk-abcdefghijklmnop Bearer secret-token",
        },
    )
    row = await db.fetch_one("SELECT * FROM app_logs ORDER BY time DESC LIMIT 1")
    details = json.loads(row["details"])
    assert "sk-abcdefghijklmnop" not in details["responseBody"]
    assert "secret-token" not in details["responseBody"]
    assert "[REDACTED]" in details["responseBody"]
