"""Unit tests for web_intel prompt assembly (no LLM / network)."""

from server.prompts.web_intel import (
    build_web_intel_native_user_prompt,
    build_web_intel_system_prompt,
    build_web_intel_tool_user_prompt,
    format_search_results_for_prompt,
)


def test_system_prompt_includes_event_schema_and_locale() -> None:
    text = build_web_intel_system_prompt(ui_locale="en")
    assert "items" in text
    assert "title" in text
    assert "English" in text or "english" in text.lower() or "EN" in text


def test_native_user_prompt_includes_query_and_task_prompt() -> None:
    text = build_web_intel_native_user_prompt(
        search_query="OpenAI pricing",
        prompt_template="Extract pricing changes only",
    )
    assert "OpenAI pricing" in text
    assert "Extract pricing changes only" in text
    assert "任務 Prompt" in text or "Prompt" in text


def test_tool_user_prompt_embeds_search_results() -> None:
    text = build_web_intel_tool_user_prompt(
        search_query="q",
        prompt_template="keep official news",
        search_results_text="1. Example\n   URL: https://example.com",
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
