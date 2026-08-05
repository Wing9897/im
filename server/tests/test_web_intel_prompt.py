"""Unit tests for web_intel Agent prompt assembly (no LLM / network)."""

from server.prompts.web_intel import (
    WEB_INTEL_AGENT_SYSTEM_PROMPT,
    build_web_intel_base_prompt,
    build_web_intel_seed_message,
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


def test_build_web_intel_seed_message_without_sources() -> None:
    text = build_web_intel_seed_message(task_name="Solo", task_id="t2")
    assert "none — pure scheduled fire" in text
    assert "t2" in text
