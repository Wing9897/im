"""Unit tests for web_scout / agent prompt assembly (no LLM / network)."""

from server.domain.agent_task_spec import agent_preset_spec
from server.prompts.agent_task import (
    AGENT_TASK_SYSTEM_PROMPT_BASE,
    build_agent_base_prompt,
    build_agent_seed_message,
)


def test_agent_system_prompt_base_is_tool_loop_json() -> None:
    assert "tool_calls" in AGENT_TASK_SYSTEM_PROMPT_BASE
    assert "JSON" in AGENT_TASK_SYSTEM_PROMPT_BASE


def test_build_agent_base_prompt_pins_task_rules() -> None:
    text = build_agent_base_prompt(
        "Only official pricing notes",
        agent_preset_spec("web_scout", has_channels=False),
    )
    assert "Only official pricing notes" in text
    assert "web.search" in text
    assert "pinned — always follow" in text
    assert "title" in text


def test_build_agent_seed_message_includes_optional_sources() -> None:
    text = build_agent_seed_message(
        task_name="Pricing",
        task_id="t1",
        spec=agent_preset_spec("web_scout", has_channels=True),
        source_messages_text="[id=m1] rumour",
    )
    assert "Choose search keywords from the task prompt" in text
    assert "rumour" in text
    assert "t1" in text
    assert "Optional search seed" not in text


def test_build_agent_seed_message_without_sources() -> None:
    text = build_agent_seed_message(
        task_name="Solo",
        task_id="t2",
        spec=agent_preset_spec("web_scout", has_channels=False),
    )
    assert "none — pure scheduled fire" in text
    assert "t2" in text
