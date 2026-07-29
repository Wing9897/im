"""Task-editor surface gate + tasks.consult_advisor tool."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

from server.agent.runtime import AgentRuntime, build_system_prompt
from server.agent.session_clock import clear_session_clocks
from server.agent.tools_registry import build_tool_schemas, execute_tool
from server.analyzer.llm_client import ConfigurableLlmClient


def test_build_tool_schemas_omits_task_advisor_by_default() -> None:
    names = {s["name"] for s in build_tool_schemas(web_search_enabled=False)}
    assert "tasks.consult_advisor" not in names
    assert "messages.search" in names


def test_build_tool_schemas_includes_task_advisor_when_enabled() -> None:
    names = {s["name"] for s in build_tool_schemas(web_search_enabled=False, task_advisor_enabled=True)}
    assert "tasks.consult_advisor" in names


def test_build_system_prompt_includes_task_advisor_only_when_enabled() -> None:
    from datetime import datetime, timezone

    now = datetime(2026, 7, 21, 2, 30, tzinfo=timezone.utc)
    off = build_system_prompt(now=now, task_advisor_enabled=False)
    on = build_system_prompt(now=now, task_advisor_enabled=True)
    assert '"name": "tasks.consult_advisor"' not in off
    assert "必須呼叫 tasks.consult_advisor" not in off
    assert '"name": "tasks.consult_advisor"' in on
    assert "必須呼叫 tasks.consult_advisor" in on


async def test_execute_tool_task_advisor_unavailable_when_disabled(app) -> None:
    result = await execute_tool(
        app.state.db,
        "tasks.consult_advisor",
        {"instruction": "監控地震"},
        context={"task_advisor_enabled": False},
    )
    assert result == {"error": "task_advisor_unavailable"}


async def test_execute_tool_task_advisor_happy_path(app) -> None:
    draft = {"name": "Quakes", "promptTemplate": "watch quakes"}
    with patch(
        "server.agent.tools_tasks.AnalysisEngine.handle_chat_assistant",
        new=AsyncMock(
            return_value={
                "message": "已建議任務設定。",
                "taskConfig": draft,
            }
        ),
    ) as mocked:
        result = await execute_tool(
            app.state.db,
            "tasks.consult_advisor",
            {"instruction": "監控地震"},
            context={
                "task_advisor_enabled": True,
                "current_task": {"name": "Draft"},
                "locale": "zh-Hant",
            },
        )
    assert result["message"] == "已建議任務設定。"
    assert result["taskConfig"] == draft
    mocked.assert_awaited_once()
    assert mocked.await_args is not None
    kwargs = mocked.await_args.kwargs
    assert kwargs["current_task"] == {"name": "Draft"}
    assert kwargs["locale"] == "zh-Hant"
    assert mocked.await_args.args[0] == "監控地震"


async def test_agent_surface_task_editor_injects_tool_and_final_task_config(app) -> None:
    clear_session_clocks()
    db = app.state.db
    draft = {"name": "Alerts", "promptTemplate": "watch quakes"}
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(
        side_effect=[
            {
                "text": json.dumps(
                    {
                        "tool_calls": [
                            {
                                "name": "tasks.consult_advisor",
                                "arguments": {"instruction": "監控地震並設為事件模式"},
                            }
                        ]
                    }
                )
            },
            {"text": json.dumps({"message": "已請任務顧問更新表單。"})},
        ]
    )
    mock_llm.close = AsyncMock()

    with patch(
        "server.agent.tools_tasks.AnalysisEngine.handle_chat_assistant",
        new=AsyncMock(return_value={"message": "顧問建議", "taskConfig": draft}),
    ):
        runtime = AgentRuntime(db, mock_llm)
        result = await runtime.chat(
            [{"role": "user", "content": "幫我設地震監控任務"}],
            session_id="sess-task-advisor",
            surface="task_editor",
            current_task={"name": "Draft"},
        )

    system = mock_llm.complete.await_args_list[0].args[0][0]["content"]
    assert '"name": "tasks.consult_advisor"' in system
    assert "必須呼叫 tasks.consult_advisor" in system
    assert result["toolCalls"][0]["name"] == "tasks.consult_advisor"
    assert result["taskConfig"] == draft
    assert "任務顧問" in result["message"] or "表單" in result["message"]


async def test_agent_without_surface_omits_task_advisor_tool(app) -> None:
    clear_session_clocks()
    db = app.state.db
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(return_value={"text": json.dumps({"message": "ok"})})
    mock_llm.close = AsyncMock()

    runtime = AgentRuntime(db, mock_llm)
    await runtime.chat(
        [{"role": "user", "content": "hi"}],
        session_id="sess-no-surface",
    )
    system = mock_llm.complete.await_args_list[0].args[0][0]["content"]
    assert '"name": "tasks.consult_advisor"' not in system
    assert "必須呼叫 tasks.consult_advisor" not in system


async def test_a2a_channel_ignores_task_editor_surface(app) -> None:
    """External A2A must never receive the task advisor tool even if surface is set."""
    clear_session_clocks()
    db = app.state.db
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(return_value={"text": json.dumps({"message": "ok"})})
    mock_llm.close = AsyncMock()

    runtime = AgentRuntime(db, mock_llm)
    await runtime.chat(
        [{"role": "user", "content": "configure a task"}],
        channel="a2a",
        surface="task_editor",
        current_task={"name": "ShouldNotMatter"},
    )
    system = mock_llm.complete.await_args_list[0].args[0][0]["content"]
    assert '"name": "tasks.consult_advisor"' not in system
