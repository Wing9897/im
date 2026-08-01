"""Tests for server.app_logging."""

from __future__ import annotations

import pytest

from server.app_logging import (
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
    import json

    details = json.loads(row["details"])
    assert details["messageKey"] == "logs:templates.batchExhausted"
    assert details["messageParams"]["taskName"] == "測試任務"
    assert details["messageParams"]["summary"] == "LLM timeout"
