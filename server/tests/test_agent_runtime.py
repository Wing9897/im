"""Agent runtime: one tool round with a mocked LLM."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

from server.agent.runtime import (
    MAX_TOOL_ROUNDS,
    AgentRuntime,
    build_system_prompt,
)
from server.agent.runtime_parse import summarize_tool_result as _summarize_tool_result
from server.agent.session_clock import clear_session_clocks
from server.agent.timeouts import (
    AGENT_WALL_TIMEOUT_CAP_SECONDS,
    agent_wall_timeout_seconds,
)
from server.analyzer.llm_client import ConfigurableLlmClient


def test_agent_round_and_wall_cap_constants() -> None:
    assert MAX_TOOL_ROUNDS == 8
    assert AGENT_WALL_TIMEOUT_CAP_SECONDS == 1200
    # Default llm_generation_timeout=120 → 120 * 9 = 1080 (under cap).
    assert agent_wall_timeout_seconds(120) == 1080.0
    # Large per-call timeout must still hit the hard wall cap.
    assert agent_wall_timeout_seconds(200) == float(AGENT_WALL_TIMEOUT_CAP_SECONDS)


def test_summarize_hard_delete_as_deleted() -> None:
    assert (
        _summarize_tool_result(
            "calendar.delete_recurring_series",
            {"deleted": True, "id": "s1"},
        )
        == "calendar.delete_recurring_series: deleted"
    )
    assert (
        _summarize_tool_result("calendar.delete_event", {"deleted": True, "id": "e1"})
        == "calendar.delete_event: deleted"
    )


async def test_agent_messages_search_via_registry(app) -> None:
    clear_session_clocks()
    db = app.state.db
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(
        side_effect=[
            {
                "text": json.dumps(
                    {
                        "tool_calls": [
                            {
                                "name": "messages.search",
                                "arguments": {"query": "地震", "limit": 5},
                            }
                        ]
                    }
                )
            },
            {"text": json.dumps({"message": "本機有一則地震相關訊息。"})},
        ]
    )
    mock_llm.close = AsyncMock()

    runtime = AgentRuntime(db, mock_llm)
    result = await runtime.chat(
        [{"role": "user", "content": "最近有沒有地震？"}],
        session_id="sess-msg-search",
    )
    assert result["toolCalls"][0]["name"] == "messages.search"
    assert "messages" in result["toolCalls"][0]["resultSummary"]


async def test_agent_compacts_long_client_history(app) -> None:
    clear_session_clocks()
    db = app.state.db
    await db.execute(
        "INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        ("agent_history_max_messages", "4", "2026-07-01T12:00:00+00:00"),
    )
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(return_value={"text": json.dumps({"message": "ok"})})
    mock_llm.close = AsyncMock()

    prior = []
    for i in range(8):
        prior.append({"role": "user", "content": f"old-user-{i}"})
        prior.append({"role": "assistant", "content": f"old-asst-{i}"})
    prior.append({"role": "user", "content": "latest-question"})

    runtime = AgentRuntime(db, mock_llm)
    await runtime.chat(prior, session_id="sess-compact")
    sent = mock_llm.complete.await_args_list[0].args[0]
    contents = [str(m.get("content") or "") for m in sent]
    assert any("較早的對話內容已省略" in c for c in contents)
    assert "old-user-0" not in contents
    assert contents[-1] == "latest-question"

    clear_session_clocks()
    db = app.state.db
    await db.execute(
        "UPDATE llm_profiles SET web_search_enabled = 0, updated_at = ? WHERE id = ?",
        ("2026-07-01T12:00:00+00:00", "__default__"),
    )
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(return_value={"text": json.dumps({"message": "ok"})})
    mock_llm.close = AsyncMock()

    runtime = AgentRuntime(db, mock_llm)
    await runtime.chat([{"role": "user", "content": "hi"}], session_id="sess-no-web")
    system = mock_llm.complete.await_args_list[0].args[0][0]["content"]
    assert '"name": "web.search"' not in system
    assert '"name": "messages.search"' in system
    assert "設定已關閉助手聯網" in system


async def test_agent_one_tool_round_then_final_answer(app) -> None:
    clear_session_clocks()
    db = app.state.db
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(
        side_effect=[
            {
                "text": json.dumps(
                    {
                        "tool_calls": [
                            {
                                "name": "calendar.window",
                                "arguments": {
                                    "start": "2026-07-13T00:00:00Z",
                                    "end": "2026-07-20T23:59:59Z",
                                    "limit": 20,
                                },
                            }
                        ]
                    }
                )
            },
            {"text": json.dumps({"message": "未來一週有例會與季度會議，建議先看 7/15 的行程。"})},
        ]
    )
    mock_llm.close = AsyncMock()

    runtime = AgentRuntime(db, mock_llm)
    result = await runtime.chat(
        [{"role": "user", "content": "最近一星期有什麼行程？"}],
        session_id="sess-test-1",
    )

    assert result["sessionId"] == "sess-test-1"
    assert "季度會議" in result["message"] or "例會" in result["message"] or "行程" in result["message"]
    assert len(result["toolCalls"]) == 1
    assert result["toolCalls"][0]["name"] == "calendar.window"
    assert "items" in result["toolCalls"][0]["resultSummary"] or "window" in result["toolCalls"][0]["resultSummary"]
    assert mock_llm.complete.await_count == 2

    first_messages = mock_llm.complete.await_args_list[0].args[0]
    assert first_messages[0]["role"] == "system"
    assert "calendar.upcoming" in first_messages[0]["content"]
    assert "當前時間（權威" in first_messages[0]["content"]
    assert "系統本地" in first_messages[0]["content"]
    assert "本輪對話開始時由本機系統時鐘注入一次" in first_messages[0]["content"]
    # Default openai_json_mode in tests is typically enabled; Ollama always prefers json.
    assert "json_mode" in mock_llm.complete.await_args_list[0].kwargs


def test_build_system_prompt_includes_injected_clock() -> None:
    from datetime import datetime, timezone

    prompt = build_system_prompt(now=datetime(2026, 7, 21, 2, 30, tzinfo=timezone.utc))
    assert "2026-07-21T02:30:00Z" in prompt
    assert "系統本地" in prompt
    assert "本輪對話開始時由本機系統時鐘注入一次" in prompt
    assert "禁止使用訓練資料中的過期年份" in prompt
    assert "Asia/Taipei" not in prompt
    assert "Traditional Chinese" in prompt
    assert '"name": "messages.search"' in prompt
    assert '"name": "intelligence.search_events"' in prompt
    assert '"name": "web.search"' in prompt
    assert "timeRange=today" in prompt
    assert "allTime=true" in prompt
    assert "禁止把 7 天窗或全庫結果說成「今日」" in prompt


def test_build_system_prompt_omits_web_search_when_disabled() -> None:
    from datetime import datetime, timezone

    prompt = build_system_prompt(
        now=datetime(2026, 7, 21, 2, 30, tzinfo=timezone.utc),
        web_search_enabled=False,
    )
    assert '"name": "messages.search"' in prompt
    assert '"name": "web.search"' not in prompt
    assert "設定已關閉助手聯網" in prompt


def test_build_system_prompt_omits_web_search_tool_for_openai_native() -> None:
    from datetime import datetime, timezone

    prompt = build_system_prompt(
        now=datetime(2026, 7, 21, 2, 30, tzinfo=timezone.utc),
        web_search_enabled=True,
        web_search_mode="openai_native",
        inject_web_search_tool=False,
    )
    assert '"name": "web.search"' not in prompt
    assert "OpenAI 原生 web_search" in prompt


def test_build_system_prompt_appends_english_output_directive() -> None:
    from datetime import datetime, timezone

    prompt = build_system_prompt(
        now=datetime(2026, 7, 21, 2, 30, tzinfo=timezone.utc),
        locale="en",
    )
    assert "Write all user-facing text in English." in prompt
    assert "Traditional Chinese" not in prompt


def test_build_system_prompt_injects_user_background_when_set() -> None:
    from datetime import datetime, timezone

    now = datetime(2026, 7, 21, 2, 30, tzinfo=timezone.utc)
    with_bg = build_system_prompt(now=now, user_background="  Ops lead, SE Asia routes  ")
    assert "（用戶背景：Ops lead, SE Asia routes）" in with_bg

    empty = build_system_prompt(now=now, user_background="")
    whitespace = build_system_prompt(now=now, user_background="   ")
    omitted = build_system_prompt(now=now)
    assert "用戶背景" not in empty
    assert "用戶背景" not in whitespace
    assert "用戶背景" not in omitted


async def test_agent_chat_uses_request_locale_for_system_prompt(app) -> None:
    clear_session_clocks()
    db = app.state.db
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(return_value={"text": json.dumps({"message": "You have one meeting tomorrow."})})
    mock_llm.close = AsyncMock()

    runtime = AgentRuntime(db, mock_llm)
    await runtime.chat(
        [{"role": "user", "content": "what is next?"}],
        session_id="sess-locale-en",
        locale="en",
    )

    system = mock_llm.complete.await_args_list[0].args[0][0]["content"]
    assert "Write all user-facing text in English." in system


async def test_conversation_clock_frozen_across_turns(app) -> None:
    """New chat samples once; follow-ups with the same sessionId reuse that clock."""
    from datetime import datetime, timezone

    clear_session_clocks()
    db = app.state.db
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(
        side_effect=[
            {"text": json.dumps({"message": "第一輪"})},
            {"text": json.dumps({"message": "第二輪"})},
            {"text": json.dumps({"message": "新對話"})},
        ]
    )

    frozen = datetime(2026, 7, 21, 2, 30, tzinfo=timezone.utc)
    runtime = AgentRuntime(db, mock_llm)

    with patch(
        "server.agent.runtime.resolve_conversation_clock",
        side_effect=[
            frozen,
            frozen,
            datetime(2026, 7, 22, 4, 0, tzinfo=timezone.utc),
        ],
    ) as clock_mock:
        first = await runtime.chat(
            [{"role": "user", "content": "第一句"}],
            session_id=None,
        )
        sid = first["sessionId"]
        await runtime.chat(
            [
                {"role": "user", "content": "第一句"},
                {"role": "assistant", "content": "第一輪"},
                {"role": "user", "content": "第二句"},
            ],
            session_id=sid,
        )
        await runtime.chat(
            [{"role": "user", "content": "全新對話"}],
            session_id=None,
        )

    assert clock_mock.call_args_list[0].kwargs["is_new_conversation"] is True
    assert clock_mock.call_args_list[1].kwargs["is_new_conversation"] is False
    assert clock_mock.call_args_list[2].kwargs["is_new_conversation"] is True

    prompts = [call.args[0][0]["content"] for call in mock_llm.complete.await_args_list]
    assert "2026-07-21T02:30:00Z" in prompts[0]
    assert "2026-07-21T02:30:00Z" in prompts[1]
    assert "2026-07-22T04:00:00Z" in prompts[2]


async def test_agent_retries_without_json_mode_when_provider_rejects_it(app) -> None:
    clear_session_clocks()
    db = app.state.db
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.provider = "openai"
    mock_llm.complete = AsyncMock(
        side_effect=[
            RuntimeError("response_format not supported"),
            {"text": json.dumps({"message": "改用一般完成後仍可回答。"})},
        ]
    )

    runtime = AgentRuntime(db, mock_llm)
    await db.execute(
        "UPDATE llm_profiles SET json_mode = 'enabled', updated_at = ? WHERE id = ?",
        ("2026-07-01T12:00:00+00:00", "__default__"),
    )
    result = await runtime.chat([{"role": "user", "content": "你好"}])

    assert "回答" in result["message"] or result["message"]
    assert mock_llm.complete.await_count == 2
    assert mock_llm.complete.await_args_list[0].kwargs.get("json_mode") is True
    assert mock_llm.complete.await_args_list[1].kwargs.get("json_mode") is False


async def test_agent_chat_endpoint_with_mocked_llm(app, client) -> None:
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(
        side_effect=[
            {"text": json.dumps({"tool_calls": [{"name": "calendar.upcoming", "arguments": {"limit": 5}}]})},
            {"text": json.dumps({"message": "接下來幾天有週會。"})},
        ]
    )
    mock_llm.close = AsyncMock()

    with patch.object(ConfigurableLlmClient, "from_assistant_staff", AsyncMock(return_value=mock_llm)):
        resp = await client.post(
            "/api/v1/agent/chat",
            json={"messages": [{"role": "user", "content": "未來有什麼？"}], "sessionId": "s2"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["sessionId"] == "s2"
    assert body["message"]
    assert body["toolCalls"][0]["name"] == "calendar.upcoming"
    mock_llm.close.assert_awaited()


async def test_iter_chat_events_emits_tool_progress(app) -> None:
    clear_session_clocks()
    db = app.state.db
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(
        side_effect=[
            {
                "text": json.dumps(
                    {
                        "tool_calls": [
                            {
                                "name": "calendar.upcoming",
                                "arguments": {"limit": 5},
                            }
                        ]
                    }
                )
            },
            {"text": json.dumps({"message": "接下來幾天有週會。"})},
        ]
    )

    runtime = AgentRuntime(db, mock_llm)
    events: list[dict] = []
    async for event in runtime.iter_chat_events(
        [{"role": "user", "content": "未來有什麼？"}],
        session_id="sess-stream-1",
    ):
        events.append(event)

    types = [event["type"] for event in events]
    assert types[0] == "llm_start"
    assert "tool_start" in types
    assert "tool_done" in types
    assert types[-1] == "final"
    assert events[-1]["message"]
    assert events[-1]["toolCalls"][0]["name"] == "calendar.upcoming"


async def test_agent_chat_stream_endpoint_with_mocked_llm(app, client) -> None:
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(
        side_effect=[
            {"text": json.dumps({"tool_calls": [{"name": "calendar.upcoming", "arguments": {"limit": 5}}]})},
            {"text": json.dumps({"message": "接下來幾天有週會。"})},
        ]
    )
    mock_llm.close = AsyncMock()

    with patch.object(ConfigurableLlmClient, "from_assistant_staff", AsyncMock(return_value=mock_llm)):
        resp = await client.post(
            "/api/v1/agent/chat/stream",
            json={"messages": [{"role": "user", "content": "未來有什麼？"}], "sessionId": "s-stream"},
        )
    assert resp.status_code == 200
    assert "application/x-ndjson" in resp.headers.get("content-type", "")

    lines = [line for line in resp.text.strip().split("\n") if line.strip()]
    payloads = [json.loads(line) for line in lines]
    types = [item["type"] for item in payloads]
    assert "tool_start" in types
    assert "tool_done" in types
    assert payloads[-1]["type"] == "final"
    assert payloads[-1]["sessionId"] == "s-stream"
    mock_llm.close.assert_awaited()
