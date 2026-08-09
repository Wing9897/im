"""Agent tick (web_scout policy): multi-round path, optional message gate, skips, fuse."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from server.agent.runtime import AgentRuntime
from server.config import set_configs
from server.domain.agent_task_spec import agent_preset_spec, agent_spec_to_db_kwargs
from server.domain.analysis_modes import AGENT_MODE
from server.domain.schedule import default_trigger_rrule, preset_to_trigger_rrule
from server.scheduler.manager import SchedulerManager
from server.scheduler.agent_tick import execute_agent_tick, parse_agent_items
from server.sse import SseBroadcaster
from server.tests import seed
from server.util import utc_now_iso


class _Broadcaster:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict]] = []

    def publish(self, event_type: str, payload: dict) -> None:
        self.events.append((event_type, payload))


async def _insert_agent_task(
    db: Any,
    *,
    task_id: str,
    prompt: str = "Extract official announcements only",
    threshold: int | None = None,
    has_channels: bool = False,
) -> None:
    now = utc_now_iso()
    policy = agent_spec_to_db_kwargs(agent_preset_spec("web_scout", has_channels=has_channels))
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, description, prompt_template, "
        "analysis_mode, analysis_time_range, version, is_active, schedule_rrule, "
        "include_in_timeline, analysis_trigger_threshold, "
        "trigger_mode, cap_calendar_read, cap_calendar_writes, cap_web_search, "
        "cap_force_web_search, cap_read_analysis_events, cap_read_items, "
        "output_calendar, output_analysis_events, "
        "created_at, updated_at) "
        "VALUES (?, ?, '', ?, ?, 'all', 1, 1, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            task_id,
            "Web intel",
            prompt,
            AGENT_MODE,
            preset_to_trigger_rrule("hourly", None),
            threshold,
            policy["trigger_mode"],
            policy["cap_calendar_read"],
            policy["cap_calendar_writes"],
            policy["cap_web_search"],
            policy["cap_force_web_search"],
            policy["cap_read_analysis_events"],
            policy["cap_read_items"],
            policy["output_calendar"],
            policy["output_analysis_events"],
            now,
            now,
        ),
    )


_WI_CHANNEL = ("telegram", "wi-gate-only")


async def _ensure_gate_channel(db: Any) -> None:
    """Isolated channel so seed TG messages do not inflate the gate count."""
    now = utc_now_iso()
    existing = await db.fetch_value(
        "SELECT COUNT(*) FROM channels WHERE platform = ? AND platform_id = ?",
        _WI_CHANNEL,
    )
    if int(existing or 0) == 0:
        await db.execute(
            "INSERT INTO channels (platform, platform_id, channel_name, created_at) VALUES (?, ?, ?, ?)",
            (*_WI_CHANNEL, "Web intel gate", now),
        )


async def _bind_gate_channel(db: Any, *, task_id: str) -> None:
    await _ensure_gate_channel(db)
    await db.execute(
        "INSERT INTO task_channels (task_id, platform, platform_id) VALUES (?, ?, ?)",
        (task_id, *_WI_CHANNEL),
    )


async def _insert_message(
    db: Any,
    *,
    message_id: str,
    content: str,
) -> None:
    await _ensure_gate_channel(db)
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO messages (id, source_id, platform, platform_id, platform_message_id, "
        "sender_id, sender_name, content, timestamp, created_at) "
        "VALUES (?, ?, ?, ?, ?, 's1', 'Sender', ?, ?, ?)",
        (message_id, seed.TG_SOURCE, *_WI_CHANNEL, message_id, content, now, now),
    )


def _patch_agent_chat(
    monkeypatch: pytest.MonkeyPatch,
    *,
    message: str = '{"items":[{"title":"Web hit","body":"From search","location":"全球"}]}',
    tool_calls: list[dict[str, Any]] | None = None,
    side_effect: Exception | None = None,
    capture: dict[str, Any] | None = None,
) -> None:
    async def _fake_from_db(_db):  # noqa: ANN001
        return type(
            "C",
            (),
            {
                "provider": "ollama",
                "model": "test",
                "close": AsyncMock(),
            },
        )()

    async def _fake_chat(self, messages, **kwargs):  # noqa: ANN001, ANN003
        del self
        if capture is not None:
            capture["messages"] = messages
            capture["kwargs"] = kwargs
        if side_effect is not None:
            raise side_effect
        return {
            "message": message,
            "sessionId": None,
            "toolCalls": tool_calls
            if tool_calls is not None
            else [{"name": "web.search", "arguments": {"query": "q"}, "resultSummary": "ok"}],
        }

    monkeypatch.setattr(
        "server.scheduler.agent_tick_schedule.ConfigurableLlmClient.from_db_for_agent",
        _fake_from_db,
    )
    monkeypatch.setattr(AgentRuntime, "chat", _fake_chat)


@pytest.mark.asyncio
async def test_default_trigger_rrule_for_agent_is_hourly() -> None:
    assert default_trigger_rrule(AGENT_MODE) == preset_to_trigger_rrule("hourly", None)


def test_parse_agent_items_from_items_json() -> None:
    items = parse_agent_items(
        '{"items":[{"title":"A","body":"B"}]}',
    )
    assert items == [{"title": "A", "body": "B"}]


def test_parse_agent_items_from_nested_message_json() -> None:
    items = parse_agent_items(
        '{"message":"{\\"items\\":[{\\"title\\":\\"N\\",\\"body\\":\\"M\\"}]}"}',
    )
    assert items[0]["title"] == "N"


@pytest.mark.asyncio
async def test_agent_tick_timed_agent_writes_events(app, monkeypatch: pytest.MonkeyPatch) -> None:
    db = app.state.db
    task_id = "agent-web-task-1"
    await _insert_agent_task(db, task_id=task_id)
    capture: dict[str, Any] = {}
    _patch_agent_chat(monkeypatch, capture=capture)

    broadcaster = _Broadcaster()
    await execute_agent_tick(db=db, broadcaster=broadcaster, task_id=task_id)

    count = await db.fetch_value(
        "SELECT COUNT(*) FROM analysis_events WHERE task_id = ?",
        (task_id,),
    )
    assert int(count or 0) == 1
    title = await db.fetch_value(
        "SELECT title FROM analysis_events WHERE task_id = ?",
        (task_id,),
    )
    assert title == "Web hit"
    assert capture["kwargs"]["channel"] == "agent"
    seed = capture["messages"][0]["content"]
    assert "Choose search keywords from the task prompt" in seed
    assert "Optional search seed" not in seed
    assert any(name == "analysis_completed" for name, _ in broadcaster.events)
    completed = [p for name, p in broadcaster.events if name == "analysis_completed"]
    assert completed[0]["webSearchMode"].startswith("agent:")


@pytest.mark.asyncio
async def test_agent_tick_forces_web_search_via_channel(
    app,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Assistant master switch off must not block scheduled agent (web_scout) ticks."""
    db = app.state.db
    task_id = "agent-web-assistant-off"
    await _insert_agent_task(db, task_id=task_id)
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        ("assistant_web_search_enabled", "false", now),
    )

    capture: dict[str, Any] = {}
    _patch_agent_chat(monkeypatch, capture=capture)
    await execute_agent_tick(db=db, broadcaster=_Broadcaster(), task_id=task_id)
    assert capture["kwargs"]["channel"] == "agent"


@pytest.mark.asyncio
async def test_schedule_tick_uses_agent_max_tool_rounds_config(
    app,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = app.state.db
    task_id = "agent-web-max-rounds"
    await _insert_agent_task(db, task_id=task_id)
    await set_configs(db, {"agent_max_tool_rounds": "12"})

    captured: dict[str, Any] = {}
    original_init = AgentRuntime.__init__

    def _capture_init(self, *args, **kwargs):  # noqa: ANN001, ANN002, ANN003
        captured["max_tool_rounds"] = kwargs.get("max_tool_rounds")
        return original_init(self, *args, **kwargs)

    monkeypatch.setattr(AgentRuntime, "__init__", _capture_init)
    _patch_agent_chat(monkeypatch)
    await execute_agent_tick(db=db, broadcaster=_Broadcaster(), task_id=task_id)
    assert captured.get("max_tool_rounds") == 12


@pytest.mark.asyncio
async def test_agent_tick_empty_query_still_runs_agent(app, monkeypatch: pytest.MonkeyPatch) -> None:
    db = app.state.db
    task_id = "agent-web-empty-query-ok"
    await _insert_agent_task(db, task_id=task_id)
    _patch_agent_chat(monkeypatch)

    broadcaster = _Broadcaster()
    await execute_agent_tick(db=db, broadcaster=broadcaster, task_id=task_id)

    row = await db.fetch_one(
        "SELECT status, error_message, agent_message FROM analysis_batches WHERE task_id = ?",
        (task_id,),
    )
    assert row is not None
    assert row["status"] == "completed"
    assert not row["error_message"]
    assert not (row["agent_message"] or "").startswith("skipped:")
    assert any(name == "analysis_completed" for name, _ in broadcaster.events)


@pytest.mark.asyncio
async def test_agent_tick_empty_prompt_records_skipped_batch(app) -> None:
    db = app.state.db
    task_id = "agent-web-empty-prompt"
    await _insert_agent_task(db, task_id=task_id, prompt="")

    broadcaster = _Broadcaster()
    await execute_agent_tick(db=db, broadcaster=broadcaster, task_id=task_id)

    row = await db.fetch_one(
        "SELECT status, agent_message FROM analysis_batches WHERE task_id = ?",
        (task_id,),
    )
    assert row is not None
    assert row["status"] == "completed"
    assert row["agent_message"] == "skipped: empty prompt_template"
    completed = [payload for name, payload in broadcaster.events if name == "analysis_completed"]
    assert completed
    assert completed[0]["skipped"] is True


@pytest.mark.asyncio
async def test_agent_message_gate_under_threshold_skips_quietly(
    app,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = app.state.db
    task_id = "agent-web-under-threshold"
    await _insert_agent_task(db, task_id=task_id, threshold=2, has_channels=True)
    await _bind_gate_channel(db, task_id=task_id)
    await _insert_message(
        db,
        message_id="msg-wi-1",
        content="only one message",
    )

    called = {"n": 0}

    async def _should_not_run(*_a: Any, **_k: Any) -> dict[str, Any]:
        called["n"] += 1
        return {"message": '{"items":[]}', "toolCalls": []}

    monkeypatch.setattr(AgentRuntime, "chat", _should_not_run)
    monkeypatch.setattr(
        "server.scheduler.agent_tick_schedule.ConfigurableLlmClient.from_db_for_agent",
        AsyncMock(return_value=type("C", (), {"close": AsyncMock()})()),
    )

    broadcaster = _Broadcaster()
    await execute_agent_tick(db=db, broadcaster=broadcaster, task_id=task_id)

    assert called["n"] == 0
    batches = await db.fetch_value(
        "SELECT COUNT(*) FROM analysis_batches WHERE task_id = ?",
        (task_id,),
    )
    assert int(batches or 0) == 0
    assert broadcaster.events == []


@pytest.mark.asyncio
async def test_agent_message_gate_claims_and_injects(
    app,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = app.state.db
    task_id = "agent-web-gate-claim"
    await _insert_agent_task(db, task_id=task_id, threshold=1, has_channels=True)
    await _bind_gate_channel(db, task_id=task_id)
    await _insert_message(
        db,
        message_id="msg-wi-2",
        content="Rumour about OpenAI pricing change",
    )

    capture: dict[str, Any] = {}
    _patch_agent_chat(
        monkeypatch,
        message='{"items":[{"title":"Verified pricing","body":"Confirmed via search"}]}',
        capture=capture,
    )

    broadcaster = _Broadcaster()
    await execute_agent_tick(db=db, broadcaster=broadcaster, task_id=task_id)

    seed = capture["messages"][0]["content"]
    assert "Rumour about OpenAI pricing change" in seed
    assert "msg-wi-2" in seed

    markers = await db.fetch_value(
        "SELECT COUNT(*) FROM analysis_markers WHERE task_id = ? AND message_id = ?",
        (task_id, "msg-wi-2"),
    )
    assert int(markers or 0) == 1

    title = await db.fetch_value(
        "SELECT title FROM analysis_events WHERE task_id = ?",
        (task_id,),
    )
    assert title == "Verified pricing"
    completed = [p for name, p in broadcaster.events if name == "analysis_completed"]
    assert completed
    assert completed[0]["messageCount"] == 1


@pytest.mark.asyncio
async def test_agent_tick_failure_is_completed_with_error_message(
    app,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = app.state.db
    task_id = "agent-web-fail"
    await _insert_agent_task(db, task_id=task_id)
    _patch_agent_chat(monkeypatch, side_effect=RuntimeError("LLM boom"))

    broadcaster = _Broadcaster()
    await execute_agent_tick(db=db, broadcaster=broadcaster, task_id=task_id)

    row = await db.fetch_one(
        "SELECT status, error_message FROM analysis_batches WHERE task_id = ?",
        (task_id,),
    )
    assert row is not None
    assert row["status"] == "completed"
    assert "LLM boom" in str(row["error_message"] or "")
    failed = [p for name, p in broadcaster.events if name == "analysis_failed"]
    assert failed
    assert "LLM boom" in failed[0]["error"]
    assert failed[0]["analysisMode"] == AGENT_MODE
    assert failed[0]["retrying"] is True
    assert failed[0]["taskDeactivated"] is False

    log_count = await db.fetch_value(
        "SELECT COUNT(*) FROM app_logs WHERE category = 'analysis'",
    )
    assert int(log_count or 0) >= 1


@pytest.mark.asyncio
async def test_agent_consecutive_failures_deactivate_task(
    app,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = app.state.db
    task_id = "agent-web-fuse"
    await _insert_agent_task(db, task_id=task_id)
    await set_configs(db, {"max_batch_retries": "2"})
    _patch_agent_chat(monkeypatch, side_effect=RuntimeError("always fail"))

    class _Sched:
        def __init__(self) -> None:
            self.unregistered: list[str] = []

        async def unregister_task(self, tid: str) -> None:
            self.unregistered.append(tid)

    sched = _Sched()
    broadcaster = _Broadcaster()

    await execute_agent_tick(
        db=db,
        broadcaster=broadcaster,
        task_id=task_id,
        scheduler=sched,  # type: ignore[arg-type]
    )
    active = await db.fetch_value("SELECT is_active FROM analysis_tasks WHERE id = ?", (task_id,))
    assert int(active or 0) == 1
    assert sched.unregistered == []

    await execute_agent_tick(
        db=db,
        broadcaster=broadcaster,
        task_id=task_id,
        scheduler=sched,  # type: ignore[arg-type]
    )
    active = await db.fetch_value("SELECT is_active FROM analysis_tasks WHERE id = ?", (task_id,))
    assert int(active or 0) == 0
    assert sched.unregistered == [task_id]

    failed = [p for name, p in broadcaster.events if name == "analysis_failed"]
    assert failed[-1]["retriesExhausted"] is True
    assert failed[-1]["retrying"] is False
    assert failed[-1]["taskDeactivated"] is True


@pytest.mark.asyncio
async def test_agent_success_clears_failure_streak(app, monkeypatch: pytest.MonkeyPatch) -> None:
    db = app.state.db
    task_id = "agent-web-clear-streak"
    await _insert_agent_task(db, task_id=task_id)
    await set_configs(db, {"max_batch_retries": "3"})

    mode = {"fail": True}

    async def _fake_from_db(_db):  # noqa: ANN001
        return type("C", (), {"provider": "ollama", "model": "t", "close": AsyncMock()})()

    async def _fake_chat(self, messages, **kwargs):  # noqa: ANN001, ANN003
        del self, messages, kwargs
        if mode["fail"]:
            raise RuntimeError("fail once")
        return {
            "message": '{"items":[{"title":"Hit","body":"ok"}]}',
            "toolCalls": [{"name": "web.search", "arguments": {}}],
        }

    monkeypatch.setattr(
        "server.scheduler.agent_tick_schedule.ConfigurableLlmClient.from_db_for_agent",
        _fake_from_db,
    )
    monkeypatch.setattr(AgentRuntime, "chat", _fake_chat)

    broadcaster = _Broadcaster()
    await execute_agent_tick(db=db, broadcaster=broadcaster, task_id=task_id)
    mode["fail"] = False
    await execute_agent_tick(db=db, broadcaster=broadcaster, task_id=task_id)

    mode["fail"] = True
    await execute_agent_tick(db=db, broadcaster=broadcaster, task_id=task_id)
    await execute_agent_tick(db=db, broadcaster=broadcaster, task_id=task_id)
    active = await db.fetch_value("SELECT is_active FROM analysis_tasks WHERE id = ?", (task_id,))
    assert int(active or 0) == 1


@pytest.mark.asyncio
async def test_scheduler_dispatch_calls_agent_tick(app, monkeypatch: pytest.MonkeyPatch) -> None:
    db = app.state.db
    task_id = "agent-web-dispatch"
    await _insert_agent_task(db, task_id=task_id)
    called: list[str] = []

    async def _fake_tick(**kwargs: Any) -> None:
        called.append(str(kwargs.get("task_id")))

    monkeypatch.setattr(
        "server.scheduler.manager_pipelines.execute_agent_tick",
        _fake_tick,
    )

    manager = SchedulerManager(db, analysis_engine=None, broadcaster=SseBroadcaster())
    await manager._execute_scheduled(task_id)
    assert called == [task_id]
