"""Unit tests for the actions layer: channel send handlers (mocked I/O),
ActionExecutor history recording, and trigger-condition evaluation."""

from __future__ import annotations

from typing import Any, AsyncIterator

import pytest

import server.actions.handlers as handlers
from server.action_config import protect_action_configuration
from server.actions import ActionExecutor
from server.db.database import Database
from server.util import utc_now_iso


@pytest.fixture
async def db(tmp_path) -> AsyncIterator[Database]:
    database = Database(str(tmp_path / "actions-test.db"))
    await database.connect()
    await database.ensure_schema()
    yield database
    await database.close()


@pytest.fixture(autouse=True)
def stub_outbound_validation(monkeypatch):
    async def allow_url(*_args, **_kwargs):
        return None

    monkeypatch.setattr(handlers, "validate_outbound_url", allow_url)
    monkeypatch.setattr(handlers, "validate_outbound_host", allow_url)


async def _seed_action(
    db: Database,
    action_id: str,
    *,
    action_type: str = "http_webhook",
    configuration: str = '{"url": "https://example.com/hook"}',
    trigger_conditions: str | None = None,
    is_enabled: int = 1,
) -> dict[str, Any]:
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO actions (id, name, action_type, configuration, trigger_conditions, "
        "is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (action_id, f"Action {action_id}", action_type, configuration, trigger_conditions, is_enabled, now, now),
    )
    return {
        "id": action_id,
        "action_type": action_type,
        "configuration": configuration,
        "trigger_conditions": trigger_conditions,
    }


class _FakeHttpResponse:
    def __init__(self, status: int, json_body: dict | None = None, text_body: str = "") -> None:
        self.status = status
        self._json = json_body or {}
        self._text = text_body

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    async def json(self) -> dict:
        return self._json

    async def text(self) -> str:
        return self._text


class _FakeSession:
    """Records requests and replies with a canned response."""

    def __init__(self, response: _FakeHttpResponse) -> None:
        self._response = response
        self.calls: list[dict[str, Any]] = []

    def post(self, url: str, json: Any = None, **_kwargs) -> _FakeHttpResponse:
        self.calls.append({"method": "POST", "url": url, "json": json})
        return self._response

    def request(
        self,
        method: str,
        url: str,
        json: Any = None,
        headers: Any = None,
        **_kwargs,
    ) -> _FakeHttpResponse:
        self.calls.append({"method": method, "url": url, "json": json, "headers": headers})
        return self._response


# ── handlers: missing-config validation ─────────────────────────────────────


async def test_telegram_bot_missing_config():
    result = await handlers.send_telegram_bot({}, "msg")
    assert result["success"] is False
    assert "bot_token" in result["error"]


async def test_discord_webhook_missing_config():
    result = await handlers.send_discord_webhook({}, "msg")
    assert result["success"] is False
    assert "webhook_url" in result["error"]


async def test_http_webhook_missing_config():
    result = await handlers.send_http_webhook({}, "msg")
    assert result["success"] is False
    assert "url" in result["error"]


async def test_mqtt_missing_config():
    result = await handlers.send_mqtt({}, "msg")
    assert result["success"] is False
    assert "broker_url" in result["error"]


async def test_mqtt_invalid_broker_url():
    result = await handlers.send_mqtt({"broker_url": "://nope", "topic": "t"}, "msg")
    assert result["success"] is False
    assert "Invalid broker_url" in result["error"]


# ── handlers: HTTP paths with mocked session ────────────────────────────────


async def test_http_webhook_success(monkeypatch):
    session = _FakeSession(_FakeHttpResponse(200))
    monkeypatch.setattr(handlers, "_get_session", lambda: session)

    result = await handlers.send_http_webhook({"url": "https://example.com/hook"}, "hello")

    assert result == {"success": True}
    assert session.calls[0]["method"] == "POST"
    assert session.calls[0]["json"] == {"message": "hello"}


async def test_http_webhook_includes_raw_data_when_configured(monkeypatch):
    session = _FakeSession(_FakeHttpResponse(200))
    monkeypatch.setattr(handlers, "_get_session", lambda: session)

    await handlers.send_http_webhook(
        {"url": "https://example.com/hook", "include_raw_data": True},
        "hello",
        {"taskId": "t-1"},
    )

    assert session.calls[0]["json"] == {"message": "hello", "rawData": {"taskId": "t-1"}}


async def test_http_webhook_invalid_method_falls_back_to_post(monkeypatch):
    session = _FakeSession(_FakeHttpResponse(200))
    monkeypatch.setattr(handlers, "_get_session", lambda: session)

    await handlers.send_http_webhook({"url": "https://example.com/hook", "method": "DELETE"}, "hello")

    assert session.calls[0]["method"] == "POST"


async def test_http_webhook_error_status(monkeypatch):
    session = _FakeSession(_FakeHttpResponse(500, text_body="boom"))
    monkeypatch.setattr(handlers, "_get_session", lambda: session)

    result = await handlers.send_http_webhook({"url": "https://example.com/hook"}, "hello")

    assert result["success"] is False
    assert "HTTP 500" in result["error"]


async def test_telegram_bot_success(monkeypatch):
    session = _FakeSession(_FakeHttpResponse(200, json_body={"ok": True}))
    monkeypatch.setattr(handlers, "_get_session", lambda: session)

    result = await handlers.send_telegram_bot({"bot_token": "tok", "chat_id": "42"}, "hello")

    assert result == {"success": True}
    assert session.calls[0]["json"] == {"chat_id": "42", "text": "hello"}


async def test_telegram_bot_api_error(monkeypatch):
    session = _FakeSession(_FakeHttpResponse(400, json_body={"ok": False, "description": "chat not found"}))
    monkeypatch.setattr(handlers, "_get_session", lambda: session)

    result = await handlers.send_telegram_bot({"bot_token": "tok", "chat_id": "42"}, "hello")

    assert result["success"] is False
    assert result["error"] == "chat not found"


async def test_discord_webhook_success_204(monkeypatch):
    session = _FakeSession(_FakeHttpResponse(204))
    monkeypatch.setattr(handlers, "_get_session", lambda: session)

    result = await handlers.send_discord_webhook({"webhook_url": "https://discord.test/hook"}, "hello")

    assert result == {"success": True}
    assert session.calls[0]["json"] == {"content": "hello"}


# ── ActionExecutor: dispatch + history ──────────────────────────────────────


async def test_execute_unknown_action_type_records_failure(db):
    action = await _seed_action(db, "act-1", action_type="http_webhook")
    action["action_type"] = "carrier-pigeon"
    executor = ActionExecutor(db)

    result = await executor.execute(action, "msg", trigger_reason="manual")

    assert result["success"] is False
    history = await db.fetch_one("SELECT * FROM action_trigger_history WHERE action_id = 'act-1'")
    assert history is not None
    assert history["status"] == "failure"
    assert "Unknown action type" in history["error_message"]


async def test_execute_success_records_history_and_last_triggered(db, monkeypatch):
    # v12: action_trigger_history.task_id / batch_id are FKs (ON DELETE SET NULL).
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, analysis_time_range, "
        "version, is_active, schedule_rrule, created_at, updated_at) "
        "VALUES (?, ?, ?, 'intel_event', 'all', 1, 1, 'FREQ=SECONDLY;INTERVAL=10', ?, ?)",
        ("t-1", "Task", "prompt", now, now),
    )
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, retry_count, "
        "created_at, updated_at) VALUES (?, ?, 1, 'completed', 1, 0, ?, ?)",
        ("b-1", "t-1", now, now),
    )
    action = await _seed_action(db, "act-1")
    action["configuration"] = protect_action_configuration(action["configuration"])
    received_configs: list[dict[str, Any]] = []

    async def fake_send(config, message, raw_data=None):
        received_configs.append(config)
        return {"success": True}

    monkeypatch.setattr("server.actions.send_http_webhook", fake_send)
    executor = ActionExecutor(db)

    result = await executor.execute(action, "msg", trigger_reason="analysis_completed", task_id="t-1", batch_id="b-1")

    assert result["success"] is True
    assert received_configs == [{"url": "https://example.com/hook"}]
    history = await db.fetch_one("SELECT * FROM action_trigger_history WHERE action_id = 'act-1'")
    assert history is not None
    assert history["status"] == "success"
    assert history["task_id"] == "t-1"
    assert history["batch_id"] == "b-1"
    assert history["error_message"] is None

    last_triggered = await db.fetch_value("SELECT last_triggered_at FROM actions WHERE id = 'act-1'")
    assert last_triggered is not None


async def test_execute_handler_exception_is_contained(db, monkeypatch):
    action = await _seed_action(db, "act-1")

    async def exploding_send(config, message, raw_data=None):
        raise RuntimeError("handler bug")

    monkeypatch.setattr("server.actions.send_http_webhook", exploding_send)
    executor = ActionExecutor(db)

    result = await executor.execute(action, "msg", trigger_reason="manual")

    assert result["success"] is False
    assert "handler bug" in result["error"]
    history = await db.fetch_one("SELECT * FROM action_trigger_history WHERE action_id = 'act-1'")
    assert history is not None
    assert history["status"] == "failure"


# ── trigger_for_completion: condition evaluation ────────────────────────────


async def _capture_executions(executor: ActionExecutor, monkeypatch) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []

    async def fake_execute(action, message, **kwargs):
        calls.append({"action_id": action["id"], **kwargs})
        return {"success": True}

    monkeypatch.setattr(executor, "execute", fake_execute)
    return calls


async def test_trigger_fires_unconditional_enabled_actions(db, monkeypatch):
    await _seed_action(db, "act-open")
    await _seed_action(db, "act-disabled", is_enabled=0)
    executor = ActionExecutor(db)
    calls = await _capture_executions(executor, monkeypatch)

    await executor.trigger_for_completion(
        task_id="t-1",
        task_name="Task",
        batch_id="b-1",
        analysis_mode="leaderboard",
        findings_count=3,
        max_score=None,
    )

    assert [c["action_id"] for c in calls] == ["act-open"]
    assert calls[0]["trigger_reason"] == "analysis_completed"


async def test_trigger_filters_by_task_id_condition(db, monkeypatch):
    await _seed_action(db, "act-match", trigger_conditions='{"task_id": "t-1"}')
    await _seed_action(db, "act-other", trigger_conditions='{"task_id": "t-2"}')
    executor = ActionExecutor(db)
    calls = await _capture_executions(executor, monkeypatch)

    await executor.trigger_for_completion(
        task_id="t-1",
        task_name="Task",
        batch_id="b-1",
        analysis_mode="leaderboard",
        findings_count=1,
        max_score=None,
    )

    assert [c["action_id"] for c in calls] == ["act-match"]


async def test_trigger_filters_by_score_threshold(db, monkeypatch):
    await _seed_action(db, "act-high", trigger_conditions='{"score_threshold": 8}')
    await _seed_action(db, "act-low", trigger_conditions='{"score_threshold": 3}')
    executor = ActionExecutor(db)
    calls = await _capture_executions(executor, monkeypatch)

    await executor.trigger_for_completion(
        task_id="t-1",
        task_name="Task",
        batch_id="b-1",
        analysis_mode="leaderboard",
        findings_count=1,
        max_score=5.0,
    )

    assert [c["action_id"] for c in calls] == ["act-low"]


async def test_trigger_score_threshold_skipped_when_no_score(db, monkeypatch):
    await _seed_action(db, "act-thresh", trigger_conditions='{"score_threshold": 1}')
    executor = ActionExecutor(db)
    calls = await _capture_executions(executor, monkeypatch)

    await executor.trigger_for_completion(
        task_id="t-1",
        task_name="Task",
        batch_id="b-1",
        analysis_mode="leaderboard",
        findings_count=1,
        max_score=None,
    )

    assert calls == []


async def test_trigger_skips_empty_findings(db, monkeypatch):
    await _seed_action(db, "act-open", trigger_conditions=None)
    executor = ActionExecutor(db)
    calls = await _capture_executions(executor, monkeypatch)

    await executor.trigger_for_completion(
        task_id="t-1",
        task_name="Task",
        batch_id="b-1",
        analysis_mode="intel_event",
        findings_count=0,
        max_score=None,
    )

    assert calls == []


async def test_trigger_fires_when_findings_present(db, monkeypatch):
    await _seed_action(db, "act-open", trigger_conditions=None)
    executor = ActionExecutor(db)
    calls = await _capture_executions(executor, monkeypatch)

    await executor.trigger_for_completion(
        task_id="t-1",
        task_name="Task",
        batch_id="b-1",
        analysis_mode="intel_event",
        findings_count=2,
        max_score=None,
    )

    assert [c["action_id"] for c in calls] == ["act-open"]
