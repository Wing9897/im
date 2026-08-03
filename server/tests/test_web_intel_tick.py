"""web_intel tick: tool / native paths, skips, dispatch, failure semantics."""

from __future__ import annotations

from typing import Any

import pytest

from server.config import set_configs
from server.domain.analysis_modes import WEB_INTEL_MODE
from server.domain.schedule import default_trigger_rrule, preset_to_trigger_rrule
from server.scheduler.manager import SchedulerManager
from server.scheduler.web_intel_tick import execute_web_intel_tick
from server.sse import SseBroadcaster
from server.util import utc_now_iso
from server.web_search.execution import WEB_INTEL_SEARCH_COUNT, WebSearchExecutionService


def _route(*, mode: str = "tool", tool_provider: str = "duckduckgo", native: str | None = None):
    return type(
        "R",
        (),
        {
            "enabled": True,
            "mode": mode,
            "tool_provider": tool_provider,
            "native_web_search": native,
            "inject_web_search_tool": native is None,
        },
    )()


class _FakeClient:
    provider = "ollama"
    model = "test"

    def __init__(self, *, text: str | None = None, fail_native: bool = False) -> None:
        self._text = text or '{"items":[{"title":"Web hit","body":"From search","location":"全球"}]}'
        self.fail_native = fail_native
        self.calls: list[dict[str, Any]] = []

    async def complete(self, messages, **kwargs):  # noqa: ANN001, ANN003
        self.calls.append({"messages": messages, **kwargs})
        if self.fail_native and kwargs.get("native_web_search"):
            raise RuntimeError("native search unavailable")
        return {
            "text": self._text,
            "prompt_tokens": 11,
            "completion_tokens": 7,
        }

    async def close(self) -> None:
        return None


class _Broadcaster:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict]] = []

    def publish(self, event_type: str, payload: dict) -> None:
        self.events.append((event_type, payload))


async def _insert_web_intel_task(
    db: Any,
    *,
    task_id: str,
    query: str = "OpenAI pricing",
    prompt: str = "Extract official announcements only",
) -> None:
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, description, prompt_template, web_search_query, "
        "analysis_mode, analysis_time_range, version, is_active, schedule_rrule, "
        "include_in_timeline, created_at, updated_at) "
        "VALUES (?, ?, '', ?, ?, ?, 'all', 1, 1, ?, 1, ?, ?)",
        (
            task_id,
            "Web intel",
            prompt,
            query,
            WEB_INTEL_MODE,
            preset_to_trigger_rrule("hourly", None),
            now,
            now,
        ),
    )


@pytest.mark.asyncio
async def test_default_trigger_rrule_for_web_intel_is_hourly() -> None:
    assert default_trigger_rrule(WEB_INTEL_MODE) == preset_to_trigger_rrule("hourly", None)


@pytest.mark.asyncio
async def test_web_intel_tick_two_step_writes_events(app, monkeypatch: pytest.MonkeyPatch) -> None:
    db = app.state.db
    task_id = "web-intel-task-1"
    await _insert_web_intel_task(db, task_id=task_id)

    async def _fake_search(query: str, **kwargs: Any) -> dict[str, Any]:
        assert kwargs.get("count") == WEB_INTEL_SEARCH_COUNT
        assert "OpenAI" in query
        return {
            "items": [
                {
                    "title": "Pricing update",
                    "url": "https://example.com/pricing",
                    "snippet": "New rates",
                }
            ],
            "provider": "duckduckgo",
            "count": 1,
        }

    async def _fake_from_db(_db):  # noqa: ANN001
        return _FakeClient()

    monkeypatch.setattr("server.web_search.execution.search_web", _fake_search)
    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.ConfigurableLlmClient.from_db",
        _fake_from_db,
    )
    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.resolve_web_search_route",
        lambda **_kwargs: _route(),
    )

    broadcaster = _Broadcaster()
    await execute_web_intel_tick(db=db, broadcaster=broadcaster, task_id=task_id)

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
    assert any(name == "analysis_completed" for name, _ in broadcaster.events)


@pytest.mark.asyncio
async def test_web_intel_tick_ignores_assistant_web_search_master_switch(app, monkeypatch: pytest.MonkeyPatch) -> None:
    """Assistant master switch off must not block scheduled web_intel ticks."""
    db = app.state.db
    task_id = "web-intel-assistant-off"
    await _insert_web_intel_task(db, task_id=task_id)
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        ("assistant_web_search_enabled", "false", now),
    )

    captured: dict[str, Any] = {}

    def _capture_route(**kwargs: Any) -> Any:
        captured.update(kwargs)
        return _route()

    async def _fake_search(query: str, **kwargs: Any) -> dict[str, Any]:
        del query, kwargs
        return {
            "items": [{"title": "Hit", "url": "https://example.com", "snippet": "s"}],
            "provider": "duckduckgo",
            "count": 1,
        }

    async def _fake_from_db(_db):  # noqa: ANN001
        return _FakeClient()

    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.resolve_web_search_route",
        _capture_route,
    )
    monkeypatch.setattr("server.web_search.execution.search_web", _fake_search)
    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.ConfigurableLlmClient.from_db",
        _fake_from_db,
    )

    await execute_web_intel_tick(db=db, broadcaster=_Broadcaster(), task_id=task_id)
    assert captured.get("web_search_enabled") is True


@pytest.mark.asyncio
async def test_web_intel_tick_empty_query_records_skipped_batch(app) -> None:
    db = app.state.db
    task_id = "web-intel-empty-query"
    await _insert_web_intel_task(db, task_id=task_id, query="")

    broadcaster = _Broadcaster()
    await execute_web_intel_tick(db=db, broadcaster=broadcaster, task_id=task_id)

    row = await db.fetch_one(
        "SELECT status, agent_message FROM analysis_batches WHERE task_id = ?",
        (task_id,),
    )
    assert row is not None
    assert row["status"] == "completed"
    assert row["agent_message"] == "skipped: empty web_search_query"
    completed = [payload for name, payload in broadcaster.events if name == "analysis_completed"]
    assert completed
    assert completed[0]["skipped"] is True
    assert completed[0]["skipReason"] == "skipped: empty web_search_query"


@pytest.mark.asyncio
async def test_web_intel_tick_empty_prompt_records_skipped_batch(app) -> None:
    db = app.state.db
    task_id = "web-intel-empty-prompt"
    await _insert_web_intel_task(db, task_id=task_id, prompt="")

    broadcaster = _Broadcaster()
    await execute_web_intel_tick(db=db, broadcaster=broadcaster, task_id=task_id)

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


@pytest.mark.parametrize("native_kind", ["openai", "gemini"])
@pytest.mark.asyncio
async def test_web_intel_tick_native_success(app, monkeypatch: pytest.MonkeyPatch, native_kind: str) -> None:
    db = app.state.db
    task_id = f"web-intel-native-{native_kind}"
    await _insert_web_intel_task(db, task_id=task_id)
    client = _FakeClient(
        text='{"items":[{"title":"Native hit","body":"From native search"}]}',
    )

    async def _fake_from_db(_db):  # noqa: ANN001
        return client

    search_called = {"n": 0}

    async def _fake_search(*_a: Any, **_k: Any) -> dict[str, Any]:
        search_called["n"] += 1
        return {"items": [], "provider": "duckduckgo", "count": 0}

    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.ConfigurableLlmClient.from_db",
        _fake_from_db,
    )
    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.resolve_web_search_route",
        lambda **_kwargs: _route(mode="native", native=native_kind),
    )
    monkeypatch.setattr("server.web_search.execution.search_web", _fake_search)

    broadcaster = _Broadcaster()
    await execute_web_intel_tick(db=db, broadcaster=broadcaster, task_id=task_id)

    title = await db.fetch_value(
        "SELECT title FROM analysis_events WHERE task_id = ?",
        (task_id,),
    )
    assert title == "Native hit"
    assert search_called["n"] == 0
    assert client.calls
    assert client.calls[0].get("native_web_search") == native_kind
    completed = [p for name, p in broadcaster.events if name == "analysis_completed"]
    assert completed
    assert completed[0]["webSearchMode"] == f"{native_kind}_native"


@pytest.mark.asyncio
async def test_web_intel_tick_native_falls_back_to_tool(app, monkeypatch: pytest.MonkeyPatch) -> None:
    db = app.state.db
    task_id = "web-intel-native-fallback"
    await _insert_web_intel_task(db, task_id=task_id)
    client = _FakeClient(
        text='{"items":[{"title":"Tool fallback","body":"after native fail"}]}',
        fail_native=True,
    )

    async def _fake_from_db(_db):  # noqa: ANN001
        return client

    async def _fake_search(query: str, **kwargs: Any) -> dict[str, Any]:
        del query
        assert kwargs.get("count") == WEB_INTEL_SEARCH_COUNT
        return {
            "items": [{"title": "Hit", "url": "https://example.com", "snippet": "s"}],
            "provider": "duckduckgo",
            "count": 1,
        }

    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.ConfigurableLlmClient.from_db",
        _fake_from_db,
    )
    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.resolve_web_search_route",
        lambda **_kwargs: _route(mode="native", native="openai"),
    )
    monkeypatch.setattr("server.web_search.execution.search_web", _fake_search)

    broadcaster = _Broadcaster()
    await execute_web_intel_tick(db=db, broadcaster=broadcaster, task_id=task_id)

    title = await db.fetch_value(
        "SELECT title FROM analysis_events WHERE task_id = ?",
        (task_id,),
    )
    assert title == "Tool fallback"
    completed = [p for name, p in broadcaster.events if name == "analysis_completed"]
    assert completed
    assert completed[0]["webSearchMode"] == "tool:duckduckgo"
    assert any(c.get("native_web_search") == "openai" for c in client.calls)
    assert any(c.get("native_web_search") in (None, "") for c in client.calls)


@pytest.mark.asyncio
async def test_web_intel_tick_failure_is_completed_with_error_message(app, monkeypatch: pytest.MonkeyPatch) -> None:
    db = app.state.db
    task_id = "web-intel-fail"
    await _insert_web_intel_task(db, task_id=task_id)

    async def _fake_from_db(_db):  # noqa: ANN001
        raise RuntimeError("LLM boom")

    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.ConfigurableLlmClient.from_db",
        _fake_from_db,
    )
    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.resolve_web_search_route",
        lambda **_kwargs: _route(),
    )

    broadcaster = _Broadcaster()
    await execute_web_intel_tick(db=db, broadcaster=broadcaster, task_id=task_id)

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
    assert failed[0]["analysisMode"] == WEB_INTEL_MODE
    assert failed[0]["retrying"] is True
    assert failed[0]["taskDeactivated"] is False

    log_count = await db.fetch_value(
        "SELECT COUNT(*) FROM app_logs WHERE category = 'analysis'",
    )
    assert int(log_count or 0) >= 1


@pytest.mark.asyncio
async def test_web_intel_tick_in_fire_retry_then_success(app, monkeypatch: pytest.MonkeyPatch) -> None:
    db = app.state.db
    task_id = "web-intel-in-fire-retry"
    await _insert_web_intel_task(db, task_id=task_id)
    calls = {"n": 0}

    async def _flaky_extract(self, *_a: Any, **_k: Any) -> tuple[list[dict], int, int, str]:  # noqa: ANN001
        del self
        calls["n"] += 1
        if calls["n"] == 1:
            raise TimeoutError("transient")
        return (
            [{"title": "Recovered", "body": "ok", "location": "全球"}],
            1,
            1,
            "tool:duckduckgo",
        )

    async def _fake_from_db(_db):  # noqa: ANN001
        return _FakeClient()

    monkeypatch.setattr(WebSearchExecutionService, "extract_web_intel_items", _flaky_extract)
    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.ConfigurableLlmClient.from_db",
        _fake_from_db,
    )
    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.resolve_web_search_route",
        lambda **_kwargs: _route(),
    )

    broadcaster = _Broadcaster()
    await execute_web_intel_tick(db=db, broadcaster=broadcaster, task_id=task_id)

    assert calls["n"] == 2
    title = await db.fetch_value("SELECT title FROM analysis_events WHERE task_id = ?", (task_id,))
    assert title == "Recovered"
    assert any(name == "analysis_completed" for name, _ in broadcaster.events)


@pytest.mark.asyncio
async def test_web_intel_consecutive_failures_deactivate_task(app, monkeypatch: pytest.MonkeyPatch) -> None:
    db = app.state.db
    task_id = "web-intel-fuse"
    await _insert_web_intel_task(db, task_id=task_id)
    await set_configs(db, {"max_batch_retries": "2"})

    async def _fake_from_db(_db):  # noqa: ANN001
        raise RuntimeError("always fail")

    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.ConfigurableLlmClient.from_db",
        _fake_from_db,
    )
    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.resolve_web_search_route",
        lambda **_kwargs: _route(),
    )

    class _Sched:
        def __init__(self) -> None:
            self.unregistered: list[str] = []

        async def unregister_task(self, tid: str) -> None:
            self.unregistered.append(tid)

    sched = _Sched()
    broadcaster = _Broadcaster()

    await execute_web_intel_tick(
        db=db,
        broadcaster=broadcaster,
        task_id=task_id,
        scheduler=sched,  # type: ignore[arg-type]
    )
    active = await db.fetch_value("SELECT is_active FROM analysis_tasks WHERE id = ?", (task_id,))
    assert int(active or 0) == 1
    assert sched.unregistered == []

    await execute_web_intel_tick(
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
    assert failed[-1]["analysisMode"] == WEB_INTEL_MODE


@pytest.mark.asyncio
async def test_web_intel_success_clears_failure_streak(app, monkeypatch: pytest.MonkeyPatch) -> None:
    db = app.state.db
    task_id = "web-intel-clear-streak"
    await _insert_web_intel_task(db, task_id=task_id)
    await set_configs(db, {"max_batch_retries": "3"})

    mode = {"fail": True}

    async def _from_db(_db):  # noqa: ANN001
        if mode["fail"]:
            raise RuntimeError("fail once")
        return _FakeClient()

    async def _fake_search(query: str, **kwargs: Any) -> dict[str, Any]:
        del query, kwargs
        return {
            "items": [{"title": "Hit", "url": "https://example.com", "snippet": "s"}],
            "provider": "duckduckgo",
            "count": 1,
        }

    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.ConfigurableLlmClient.from_db",
        _from_db,
    )
    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.resolve_web_search_route",
        lambda **_kwargs: _route(),
    )
    monkeypatch.setattr("server.web_search.execution.search_web", _fake_search)

    broadcaster = _Broadcaster()
    await execute_web_intel_tick(db=db, broadcaster=broadcaster, task_id=task_id)
    mode["fail"] = False
    await execute_web_intel_tick(db=db, broadcaster=broadcaster, task_id=task_id)

    # After success, two more failures must not deactivate (streak reset).
    mode["fail"] = True
    await execute_web_intel_tick(db=db, broadcaster=broadcaster, task_id=task_id)
    await execute_web_intel_tick(db=db, broadcaster=broadcaster, task_id=task_id)
    active = await db.fetch_value("SELECT is_active FROM analysis_tasks WHERE id = ?", (task_id,))
    assert int(active or 0) == 1


@pytest.mark.asyncio
async def test_scheduler_dispatch_calls_web_intel_tick(app, monkeypatch: pytest.MonkeyPatch) -> None:
    db = app.state.db
    task_id = "web-intel-dispatch"
    await _insert_web_intel_task(db, task_id=task_id)
    called: list[str] = []

    async def _fake_tick(**kwargs: Any) -> None:
        called.append(str(kwargs.get("task_id")))

    monkeypatch.setattr("server.scheduler.manager.execute_web_intel_tick", _fake_tick)

    manager = SchedulerManager(db, analysis_engine=None, broadcaster=SseBroadcaster())
    await manager._execute_scheduled(task_id)
    assert called == [task_id]
