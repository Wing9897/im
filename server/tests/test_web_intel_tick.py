"""web_intel tick: tool two-step path stores analysis_events."""

from __future__ import annotations

from typing import Any

import pytest

from server.domain.analysis_modes import WEB_INTEL_MODE
from server.domain.schedule import default_trigger_rrule, legacy_to_trigger_rrule
from server.scheduler.web_intel_tick import execute_web_intel_tick
from server.util import utc_now_iso


class _FakeClient:
    provider = "ollama"
    model = "test"

    async def complete(self, messages, **kwargs):  # noqa: ANN001, ANN003
        del messages, kwargs
        return {
            "text": '{"items":[{"title":"Web hit","body":"From search","location":"全球"}]}',
            "prompt_tokens": 11,
            "completion_tokens": 7,
        }

    async def close(self) -> None:
        return None


@pytest.mark.asyncio
async def test_default_trigger_rrule_for_web_intel_is_hourly() -> None:
    assert default_trigger_rrule(WEB_INTEL_MODE) == legacy_to_trigger_rrule("hourly", None)


@pytest.mark.asyncio
async def test_web_intel_tick_two_step_writes_events(app, monkeypatch: pytest.MonkeyPatch) -> None:
    db = app.state.db
    now = utc_now_iso()
    task_id = "web-intel-task-1"
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, description, prompt_template, web_search_query, "
        "analysis_mode, analysis_time_range, version, is_active, schedule_rrule, "
        "include_in_timeline, created_at, updated_at) "
        "VALUES (?, ?, '', ?, ?, ?, 'all', 1, 1, ?, 1, ?, ?)",
        (
            task_id,
            "Web intel",
            "Extract official announcements only",
            "OpenAI pricing",
            WEB_INTEL_MODE,
            legacy_to_trigger_rrule("hourly", None),
            now,
            now,
        ),
    )

    async def _fake_search(query: str, **kwargs: Any) -> dict[str, Any]:
        del kwargs
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

    monkeypatch.setattr("server.scheduler.web_intel_tick.search_web", _fake_search)
    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.ConfigurableLlmClient.from_db",
        _fake_from_db,
    )
    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.resolve_web_search_route",
        lambda **_kwargs: type(
            "R",
            (),
            {
                "enabled": True,
                "mode": "tool",
                "tool_provider": "duckduckgo",
                "native_web_search": None,
            },
        )(),
    )

    class _Broadcaster:
        def __init__(self) -> None:
            self.events: list[tuple[str, dict]] = []

        def publish(self, name: str, payload: dict) -> None:
            self.events.append((name, payload))

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
async def test_web_intel_tick_ignores_assistant_web_search_master_switch(
    app, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Assistant master switch off must not block scheduled web_intel ticks."""
    db = app.state.db
    now = utc_now_iso()
    task_id = "web-intel-assistant-off"
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, description, prompt_template, web_search_query, "
        "analysis_mode, analysis_time_range, version, is_active, schedule_rrule, "
        "include_in_timeline, created_at, updated_at) "
        "VALUES (?, ?, '', ?, ?, ?, 'all', 1, 1, ?, 1, ?, ?)",
        (
            task_id,
            "Web intel",
            "Extract official announcements only",
            "OpenAI pricing",
            WEB_INTEL_MODE,
            legacy_to_trigger_rrule("hourly", None),
            now,
            now,
        ),
    )
    await db.execute(
        "INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        ("assistant_web_search_enabled", "false", now),
    )

    captured: dict[str, Any] = {}

    def _capture_route(**kwargs: Any) -> Any:
        captured.update(kwargs)
        return type(
            "R",
            (),
            {
                "enabled": True,
                "mode": "tool",
                "tool_provider": "duckduckgo",
                "native_web_search": None,
            },
        )()

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
    monkeypatch.setattr("server.scheduler.web_intel_tick.search_web", _fake_search)
    monkeypatch.setattr(
        "server.scheduler.web_intel_tick.ConfigurableLlmClient.from_db",
        _fake_from_db,
    )

    class _Broadcaster:
        def publish(self, name: str, payload: dict) -> None:
            del name, payload

    await execute_web_intel_tick(db=db, broadcaster=_Broadcaster(), task_id=task_id)
    assert captured.get("web_search_enabled") is True


@pytest.mark.asyncio
async def test_web_intel_tick_empty_query_records_skipped_batch(
    app, monkeypatch: pytest.MonkeyPatch
) -> None:
    db = app.state.db
    now = utc_now_iso()
    task_id = "web-intel-empty-query"
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, description, prompt_template, web_search_query, "
        "analysis_mode, analysis_time_range, version, is_active, schedule_rrule, "
        "include_in_timeline, created_at, updated_at) "
        "VALUES (?, ?, '', ?, '', ?, 'all', 1, 1, ?, 1, ?, ?)",
        (
            task_id,
            "Web intel empty",
            "Extract official announcements only",
            WEB_INTEL_MODE,
            legacy_to_trigger_rrule("hourly", None),
            now,
            now,
        ),
    )

    class _Broadcaster:
        def __init__(self) -> None:
            self.events: list[tuple[str, dict]] = []

        def publish(self, name: str, payload: dict) -> None:
            self.events.append((name, payload))

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
