"""Agent system-prompt assembly tests."""

from __future__ import annotations

from datetime import UTC, datetime

from server.agent.runtime import build_system_prompt


def test_build_system_prompt_includes_injected_clock() -> None:
    prompt = build_system_prompt(now=datetime(2026, 7, 21, 2, 30, tzinfo=UTC))
    assert "2026-07-21T02:30:00Z" in prompt
    assert "系統本地" in prompt
    assert "本輪對話開始時由本機系統時鐘注入一次" in prompt
    assert "禁止使用訓練資料中的過期年份" in prompt
    assert "Asia/Taipei" not in prompt
    assert "Traditional Chinese" in prompt
    assert '"name": "messages.search"' in prompt
    assert '"name": "intelligence.search_events"' in prompt
    assert '"name": "web.search"' in prompt
    assert '"name": "web.fetch"' in prompt
    assert "timeRange=today" in prompt
    assert "allTime=true" in prompt
    assert "禁止把 7 天窗或全庫結果說成「今日」" in prompt


def test_build_system_prompt_omits_web_search_when_disabled() -> None:
    prompt = build_system_prompt(
        now=datetime(2026, 7, 21, 2, 30, tzinfo=UTC),
        web_search_enabled=False,
    )
    assert '"name": "messages.search"' in prompt
    assert '"name": "web.search"' not in prompt
    assert '"name": "web.fetch"' not in prompt
    assert "設定已關閉助手聯網" in prompt


def test_build_system_prompt_omits_web_search_tool_for_openai_native() -> None:
    prompt = build_system_prompt(
        now=datetime(2026, 7, 21, 2, 30, tzinfo=UTC),
        web_search_enabled=True,
        web_search_mode="openai_native",
        inject_web_search_tool=False,
    )
    assert '"name": "web.search"' not in prompt
    assert '"name": "web.fetch"' not in prompt
    assert "OpenAI 原生 web_search" in prompt


def test_build_system_prompt_appends_english_output_directive() -> None:
    prompt = build_system_prompt(
        now=datetime(2026, 7, 21, 2, 30, tzinfo=UTC),
        locale="en",
    )
    assert "Write all user-facing text in English." in prompt
    assert "Traditional Chinese" not in prompt


def test_build_system_prompt_injects_user_background_when_set() -> None:
    now = datetime(2026, 7, 21, 2, 30, tzinfo=UTC)
    with_bg = build_system_prompt(now=now, user_background="  Ops lead, SE Asia routes  ")
    assert "（用戶背景：Ops lead, SE Asia routes）" in with_bg

    empty = build_system_prompt(now=now, user_background="")
    whitespace = build_system_prompt(now=now, user_background="   ")
    omitted = build_system_prompt(now=now)
    assert "用戶背景" not in empty
    assert "用戶背景" not in whitespace
    assert "用戶背景" not in omitted
