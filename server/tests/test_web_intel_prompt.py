"""Unit tests for web_intel prompt assembly (no LLM / network)."""

from server.prompts.web_intel import (
    WEB_INTEL_AGENT_SYSTEM_PROMPT,
    build_web_intel_base_prompt,
    build_web_intel_native_user_prompt,
    build_web_intel_seed_message,
    build_web_intel_system_prompt,
    build_web_intel_tool_user_prompt,
    format_search_results_for_prompt,
)


def test_agent_system_prompt_forces_search_and_forbids_calendar_writes() -> None:
    assert "web.search" in WEB_INTEL_AGENT_SYSTEM_PROMPT
    assert "calendar.create_event" in WEB_INTEL_AGENT_SYSTEM_PROMPT
    assert '"items"' in WEB_INTEL_AGENT_SYSTEM_PROMPT or '{"items"' in WEB_INTEL_AGENT_SYSTEM_PROMPT


def test_build_web_intel_base_prompt_pins_task_rules() -> None:
    text = build_web_intel_base_prompt("Only official pricing notes")
    assert "Only official pricing notes" in text
    assert "web.search" in text
    assert "title" in text


def test_build_web_intel_seed_message_includes_optional_sources() -> None:
    text = build_web_intel_seed_message(
        task_name="Pricing",
        task_id="t1",
        source_messages_text="[id=m1] rumour",
    )
    assert "Choose search keywords yourself" in text
    assert "rumour" in text
    assert "t1" in text
    assert "Optional search seed" not in text


def test_system_prompt_includes_event_schema_and_locale() -> None:
    text = build_web_intel_system_prompt(ui_locale="en")
    assert "items" in text
    assert "title" in text
    assert "English" in text or "english" in text.lower() or "EN" in text
    assert "web-intel analyst" in text.lower() or "web intel" in text.lower()


def test_system_prompt_zh_hans() -> None:
    text = build_web_intel_system_prompt(ui_locale="zh-Hans")
    assert "网络情报" in text or "情报" in text
    assert "简体中文" in text or "Simplified" in text


def test_native_user_prompt_includes_query_and_task_prompt() -> None:
    text = build_web_intel_native_user_prompt(
        search_query="OpenAI pricing",
        prompt_template="Extract pricing changes only",
        ui_locale="zh-Hant",
    )
    assert "OpenAI pricing" in text
    assert "Extract pricing changes only" in text
    assert "任務 Prompt" in text or "Prompt" in text


def test_native_user_prompt_english_scaffold() -> None:
    text = build_web_intel_native_user_prompt(
        search_query="q",
        prompt_template="p",
        ui_locale="en",
    )
    assert "Search the web" in text
    assert "[Search query / keywords]" in text


def test_tool_user_prompt_embeds_search_results() -> None:
    text = build_web_intel_tool_user_prompt(
        search_query="q",
        prompt_template="keep official news",
        search_results_text="1. Example\n   URL: https://example.com",
        ui_locale="zh-Hant",
    )
    assert "keep official news" in text
    assert "https://example.com" in text


def test_format_search_results_for_prompt() -> None:
    text = format_search_results_for_prompt(
        [
            {"title": "A", "url": "https://a.example", "snippet": "hello"},
            {"title": "", "href": "https://b.example", "description": "world"},
        ]
    )
    assert "https://a.example" in text
    assert "hello" in text
    assert "https://b.example" in text
