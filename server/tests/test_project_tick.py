"""Project tick registration, empty-skip, and drain waves (no live LLM)."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from server.analyzer.llm_client import ConfigurableLlmClient
from server.config import set_configs
from server.db.database import Database, TransactionDb
from server.queries.tasks_queries import insert_analysis_task
from server.scheduler.manager import SchedulerManager
from server.scheduler.project_tick import (
    _MESSAGE_SUMMARY_LIMIT,
    build_project_seed_message,
    execute_project_tick,
)
from server.sse import SseBroadcaster
from server.util import new_id, utc_now_iso


async def _insert_project(
    db: Database,
    task_id: str = "proj-tick",
    *,
    project_wave_interval_seconds: int | None = 0,
) -> None:
    now = utc_now_iso()
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await insert_analysis_task(
            tx,
            task_id=task_id,
            name="PM",
            description=None,
            prompt_template="Keep demos current",
            analysis_mode="project",
            analysis_time_range="all",
            schedule_type="hourly",
            schedule_value=None,
            rrule=None,
            event_start_time=None,
            event_end_time=None,
            event_is_all_day=0,
            event_location=None,
            event_description=None,
            project_wave_interval_seconds=project_wave_interval_seconds,
            now=now,
        )


async def _bind_source_with_messages(
    db: Database,
    *,
    task_id: str,
    count: int,
    platform: str = "rss",
    platform_id: str = "feed-pm",
    start_minute: int = 1,
) -> None:
    await db.execute(
        "INSERT OR IGNORE INTO channels (platform, platform_id, channel_name, created_at) VALUES (?, ?, ?, ?)",
        (platform, platform_id, "PM feed", utc_now_iso()),
    )
    await db.execute(
        "INSERT OR IGNORE INTO task_channels (task_id, platform, platform_id) VALUES (?, ?, ?)",
        (task_id, platform, platform_id),
    )
    for i in range(count):
        minute = start_minute + i
        ts = f"2026-07-28T10:{minute:02d}:00Z"
        await db.execute(
            "INSERT INTO messages (id, platform, platform_id, content, timestamp, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (new_id(), platform, platform_id, f"msg-{i}", ts, utc_now_iso()),
        )


def test_build_project_seed_includes_prompt_and_empty_messages() -> None:
    seed = build_project_seed_message(
        task={"id": "p1", "name": "Alpha", "prompt_template": "Rule A"},
        calendar_summary="Owned: 0",
        message_lines=[],
        cursor=None,
    )
    assert "Alpha" in seed
    assert "No new messages" in seed
    assert "Drain wave 1" in seed
    assert "pinned Project goals" in seed
    # Goals belong in system prompt, not the user seed.
    assert "Rule A" not in seed


def test_build_project_base_prompt_pins_goals() -> None:
    from server.prompts.project import build_project_base_prompt

    base = build_project_base_prompt("Keep demos current")
    assert "Keep demos current" in base
    assert "pinned — always follow" in base
    assert "專案管理助手" in base


@pytest.mark.asyncio
async def test_project_task_is_registered_on_scheduler(app) -> None:
    db: Database = app.state.db
    await _insert_project(db, "proj-reg")
    manager = SchedulerManager(db, analysis_engine=None, broadcaster=SseBroadcaster())
    await manager.register_task("proj-reg")
    assert manager._scheduler.get_job("proj-reg") is not None


@pytest.mark.asyncio
async def test_execute_project_tick_skips_llm_without_messages(app) -> None:
    db: Database = app.state.db
    await _insert_project(db, "proj-run")
    broadcaster = SseBroadcaster()

    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(return_value={"text": '{"message":"should not run"}'})
    mock_llm.close = AsyncMock()
    mock_llm.provider = "ollama"

    with patch.object(
        ConfigurableLlmClient,
        "from_db_for_agent",
        AsyncMock(return_value=mock_llm),
    ) as from_db:
        await execute_project_tick(db=db, broadcaster=broadcaster, task_id="proj-run")

    from_db.assert_not_awaited()
    mock_llm.complete.assert_not_awaited()
    batch = await db.fetch_one(
        "SELECT status, message_count, agent_message, tool_calls_json FROM analysis_batches WHERE task_id = ?",
        ("proj-run",),
    )
    assert batch is not None
    assert batch["status"] == "completed"
    assert int(batch["message_count"]) == 0
    assert batch["agent_message"] == "skipped: no new messages"
    assert batch["tool_calls_json"] == "[]"


@pytest.mark.asyncio
async def test_execute_project_tick_persists_tool_calls(app) -> None:
    db: Database = app.state.db
    await _insert_project(db, "proj-tools")
    await _bind_source_with_messages(db, task_id="proj-tools", count=1)
    broadcaster = SseBroadcaster()

    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(
        side_effect=[
            {"text": '{"tool_calls":[{"name":"calendar.upcoming","arguments":{"limit":3}}]}'},
            {"text": '{"message":"checked calendar"}'},
        ]
    )
    mock_llm.close = AsyncMock()
    mock_llm.provider = "ollama"

    with patch.object(
        ConfigurableLlmClient,
        "from_db_for_agent",
        AsyncMock(return_value=mock_llm),
    ):
        await execute_project_tick(db=db, broadcaster=broadcaster, task_id="proj-tools")

    batch = await db.fetch_one(
        "SELECT status, agent_message, tool_calls_json, message_count FROM analysis_batches WHERE task_id = ?",
        ("proj-tools",),
    )
    assert batch is not None
    assert batch["status"] == "completed"
    assert int(batch["message_count"]) == 1
    assert "checked calendar" in (batch["agent_message"] or "")
    assert "calendar.upcoming" in (batch["tool_calls_json"] or "")


@pytest.mark.asyncio
async def test_execute_project_tick_drains_multiple_waves(app) -> None:
    db: Database = app.state.db
    await _insert_project(db, "proj-drain", project_wave_interval_seconds=0)
    # Two full waves (limit + 1) so the second wave is partial and ends the drain.
    await _bind_source_with_messages(
        db,
        task_id="proj-drain",
        count=_MESSAGE_SUMMARY_LIMIT + 1,
    )
    broadcaster = SseBroadcaster()

    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(
        side_effect=[
            {"text": '{"message":"wave-one"}'},
            {"text": '{"message":"wave-two"}'},
        ]
    )
    mock_llm.close = AsyncMock()
    mock_llm.provider = "ollama"

    with patch.object(
        ConfigurableLlmClient,
        "from_db_for_agent",
        AsyncMock(return_value=mock_llm),
    ):
        await execute_project_tick(db=db, broadcaster=broadcaster, task_id="proj-drain")

    assert mock_llm.complete.await_count == 2
    batch = await db.fetch_one(
        "SELECT status, message_count, agent_message FROM analysis_batches WHERE task_id = ?",
        ("proj-drain",),
    )
    assert batch is not None
    assert batch["status"] == "completed"
    assert int(batch["message_count"]) == _MESSAGE_SUMMARY_LIMIT + 1
    assert "wave-one" in (batch["agent_message"] or "")
    assert "wave-two" in (batch["agent_message"] or "")
    cursor = await db.fetch_one(
        "SELECT last_message_at FROM project_message_cursors WHERE task_id = ?",
        ("proj-drain",),
    )
    assert cursor is not None
    from server.queries.project_tick_queries import parse_project_message_cursor

    parsed = parse_project_message_cursor(str(cursor["last_message_at"]))
    assert parsed is not None
    assert parsed.timestamp.endswith(":41:00Z") or "T10:41" in parsed.timestamp
    assert parsed.message_id  # composite cursor stores last message id


@pytest.mark.asyncio
async def test_execute_project_tick_cools_between_waves(app) -> None:
    db: Database = app.state.db
    await _insert_project(db, "proj-cool", project_wave_interval_seconds=7)
    await _bind_source_with_messages(
        db,
        task_id="proj-cool",
        count=_MESSAGE_SUMMARY_LIMIT + 1,
    )
    broadcaster = SseBroadcaster()

    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(
        side_effect=[
            {"text": '{"message":"wave-one"}'},
            {"text": '{"message":"wave-two"}'},
        ]
    )
    mock_llm.close = AsyncMock()
    mock_llm.provider = "ollama"

    with (
        patch.object(
            ConfigurableLlmClient,
            "from_db_for_agent",
            AsyncMock(return_value=mock_llm),
        ),
        patch("server.scheduler.project_tick.asyncio.sleep", new_callable=AsyncMock) as sleep_mock,
    ):
        await execute_project_tick(db=db, broadcaster=broadcaster, task_id="proj-cool")

    assert mock_llm.complete.await_count == 2
    sleep_mock.assert_awaited_once_with(7)


@pytest.mark.asyncio
async def test_execute_project_tick_reuses_session_across_waves(app) -> None:
    db: Database = app.state.db
    await _insert_project(db, "proj-session", project_wave_interval_seconds=0)
    await _bind_source_with_messages(
        db,
        task_id="proj-session",
        count=_MESSAGE_SUMMARY_LIMIT + 1,
    )
    broadcaster = SseBroadcaster()

    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(
        side_effect=[
            {"text": '{"message":"wave-one"}'},
            {"text": '{"message":"wave-two"}'},
        ]
    )
    mock_llm.close = AsyncMock()
    mock_llm.provider = "ollama"

    from server.agent.runtime import AgentRuntime

    chat_calls: list[dict] = []
    original_chat = AgentRuntime.chat

    async def _tracking_chat(self, messages, **kwargs):
        chat_calls.append({"messages": messages, "kwargs": kwargs})
        return await original_chat(self, messages, **kwargs)

    with (
        patch.object(
            ConfigurableLlmClient,
            "from_db_for_agent",
            AsyncMock(return_value=mock_llm),
        ),
        patch.object(AgentRuntime, "chat", _tracking_chat),
    ):
        await execute_project_tick(db=db, broadcaster=broadcaster, task_id="proj-session")

    assert len(chat_calls) == 2
    first = chat_calls[0]
    second = chat_calls[1]
    assert first["kwargs"].get("session_id") is None
    assert first["kwargs"].get("base_prompt")
    assert "Keep demos current" in str(first["kwargs"]["base_prompt"])
    assert second["kwargs"].get("session_id")  # sticky after wave 1
    assert len(second["messages"]) > len(first["messages"])
    assert second["messages"][0]["role"] == "user"
    assert second["messages"][1]["role"] == "assistant"
    assert "wave-one" in second["messages"][1]["content"]


@pytest.mark.asyncio
async def test_execute_project_tick_stops_before_next_wave_when_paused(app) -> None:
    db: Database = app.state.db
    await _insert_project(db, "proj-pause", project_wave_interval_seconds=0)
    await _bind_source_with_messages(
        db,
        task_id="proj-pause",
        count=_MESSAGE_SUMMARY_LIMIT + 1,
    )
    broadcaster = SseBroadcaster()

    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.close = AsyncMock()
    mock_llm.provider = "ollama"

    async def _pause_after_first_wave(*_args, **_kwargs):
        await set_configs(db, {"analysis_paused": "true"})
        return {"text": '{"message":"wave-one"}'}

    mock_llm.complete = AsyncMock(side_effect=_pause_after_first_wave)

    with patch.object(
        ConfigurableLlmClient,
        "from_db_for_agent",
        AsyncMock(return_value=mock_llm),
    ):
        await execute_project_tick(db=db, broadcaster=broadcaster, task_id="proj-pause")

    assert mock_llm.complete.await_count == 1
    batch = await db.fetch_one(
        "SELECT status, message_count, agent_message FROM analysis_batches WHERE task_id = ?",
        ("proj-pause",),
    )
    assert batch is not None
    assert batch["status"] == "completed"
    assert int(batch["message_count"]) == _MESSAGE_SUMMARY_LIMIT
    assert "wave-one" in (batch["agent_message"] or "")
    assert "analysis paused" in (batch["agent_message"] or "")
    assert "deferred" in (batch["agent_message"] or "")


@pytest.mark.asyncio
async def test_execute_project_tick_stops_before_next_wave_when_task_disabled(app) -> None:
    db: Database = app.state.db
    await _insert_project(db, "proj-disable", project_wave_interval_seconds=0)
    await _bind_source_with_messages(
        db,
        task_id="proj-disable",
        count=_MESSAGE_SUMMARY_LIMIT + 1,
    )
    broadcaster = SseBroadcaster()

    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.close = AsyncMock()
    mock_llm.provider = "ollama"

    async def _disable_after_first_wave(*_args, **_kwargs):
        await db.execute(
            "UPDATE analysis_tasks SET is_active = 0 WHERE id = ?",
            ("proj-disable",),
        )
        return {"text": '{"message":"wave-one"}'}

    mock_llm.complete = AsyncMock(side_effect=_disable_after_first_wave)

    with patch.object(
        ConfigurableLlmClient,
        "from_db_for_agent",
        AsyncMock(return_value=mock_llm),
    ):
        await execute_project_tick(db=db, broadcaster=broadcaster, task_id="proj-disable")

    assert mock_llm.complete.await_count == 1
    batch = await db.fetch_one(
        "SELECT status, message_count, agent_message FROM analysis_batches WHERE task_id = ?",
        ("proj-disable",),
    )
    assert batch is not None
    assert int(batch["message_count"]) == _MESSAGE_SUMMARY_LIMIT
    assert "task disabled" in (batch["agent_message"] or "")
    assert "deferred" in (batch["agent_message"] or "")


@pytest.mark.asyncio
async def test_execute_project_tick_wave_hard_timeout_defers_remaining(app) -> None:
    db: Database = app.state.db
    await _insert_project(db, "proj-timeout", project_wave_interval_seconds=0)
    await _bind_source_with_messages(
        db,
        task_id="proj-timeout",
        count=_MESSAGE_SUMMARY_LIMIT + 1,
    )
    broadcaster = SseBroadcaster()

    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.close = AsyncMock()
    mock_llm.provider = "ollama"
    mock_llm.complete = AsyncMock(return_value={"text": '{"message":"unused"}'})

    async def _hang_chat(self, *_args, **_kwargs):
        await asyncio.sleep(10)
        return {"message": "late", "sessionId": "sid", "toolCalls": []}

    from server.agent.runtime import AgentRuntime
    from server.config import get_config_int as real_get_config_int

    async def _config_int(db_arg, key: str) -> int:
        if key == "llm_generation_timeout":
            return 1
        return await real_get_config_int(db_arg, key)

    with (
        patch.object(
            ConfigurableLlmClient,
            "from_db_for_agent",
            AsyncMock(return_value=mock_llm),
        ),
        patch.object(AgentRuntime, "chat", _hang_chat),
        patch("server.scheduler.project_tick.get_config_int", side_effect=_config_int),
    ):
        await execute_project_tick(db=db, broadcaster=broadcaster, task_id="proj-timeout")

    batch = await db.fetch_one(
        "SELECT status, error_message, agent_message FROM analysis_batches WHERE task_id = ?",
        ("proj-timeout",),
    )
    assert batch is not None
    assert batch["status"] == "completed"
    assert batch["error_message"] is None
    assert "hard timeout" in (batch["agent_message"] or "")

    db: Database = app.state.db
    await _insert_project(db, "proj-fail")
    await _bind_source_with_messages(db, task_id="proj-fail", count=1)
    broadcaster = SseBroadcaster()

    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(side_effect=RuntimeError("llm down"))
    mock_llm.close = AsyncMock()
    mock_llm.provider = "ollama"

    with patch.object(
        ConfigurableLlmClient,
        "from_db_for_agent",
        AsyncMock(return_value=mock_llm),
    ):
        await execute_project_tick(db=db, broadcaster=broadcaster, task_id="proj-fail")

    batch = await db.fetch_one(
        "SELECT status, error_message, agent_message, tool_calls_json FROM analysis_batches WHERE task_id = ?",
        ("proj-fail",),
    )
    assert batch is not None
    assert batch["status"] == "completed"
    assert "llm down" in (batch["error_message"] or "")
    assert batch["agent_message"] is None
    assert batch["tool_calls_json"] is None


def test_serialize_tick_tool_calls_truncates() -> None:
    from server.scheduler.project_tick import serialize_tick_tool_calls

    payload = serialize_tick_tool_calls(
        [
            {
                "name": "calendar.upcoming",
                "arguments": {"limit": 5},
                "resultSummary": "ok",
            },
            {"name": ""},
        ]
    )
    assert '"name": "calendar.upcoming"' in payload
    assert '"resultSummary": "ok"' in payload
    assert serialize_tick_tool_calls(None) == "[]"
