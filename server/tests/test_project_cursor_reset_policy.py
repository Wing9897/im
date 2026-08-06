"""Unit tests for soft project-cursor reset policy."""

from __future__ import annotations

from server.domain.agent_task_spec import TRIGGER_MESSAGE_CURSOR, TRIGGER_SCHEDULE
from server.domain.analysis_modes import AGENT_MODE, LEADERBOARD_MODE
from server.services.task_writes import should_reset_project_message_cursor


def test_schedule_only_edit_keeps_cursor() -> None:
    assert (
        should_reset_project_message_cursor(
            existing_mode=AGENT_MODE,
            effective_mode=AGENT_MODE,
            existing_prompt="Keep demos",
            new_prompt="Keep demos",
            channels_changed=False,
            existing_trigger=TRIGGER_MESSAGE_CURSOR,
            effective_trigger=TRIGGER_MESSAGE_CURSOR,
        )
        is False
    )


def test_prompt_change_resets_cursor() -> None:
    assert (
        should_reset_project_message_cursor(
            existing_mode=AGENT_MODE,
            effective_mode=AGENT_MODE,
            existing_prompt="Keep demos",
            new_prompt="New goals",
            channels_changed=False,
            existing_trigger=TRIGGER_MESSAGE_CURSOR,
            effective_trigger=TRIGGER_MESSAGE_CURSOR,
        )
        is True
    )


def test_channel_rebinding_resets_cursor() -> None:
    assert (
        should_reset_project_message_cursor(
            existing_mode=AGENT_MODE,
            effective_mode=AGENT_MODE,
            existing_prompt="Keep demos",
            new_prompt="Keep demos",
            channels_changed=True,
            existing_trigger=TRIGGER_MESSAGE_CURSOR,
            effective_trigger=TRIGGER_MESSAGE_CURSOR,
        )
        is True
    )


def test_leaving_message_cursor_resets_cursor() -> None:
    assert (
        should_reset_project_message_cursor(
            existing_mode=AGENT_MODE,
            effective_mode=LEADERBOARD_MODE,
            existing_prompt="Keep demos",
            new_prompt="Keep demos",
            channels_changed=False,
            existing_trigger=TRIGGER_MESSAGE_CURSOR,
            effective_trigger=None,
        )
        is True
    )


def test_entering_message_cursor_resets_cursor() -> None:
    assert (
        should_reset_project_message_cursor(
            existing_mode=LEADERBOARD_MODE,
            effective_mode=AGENT_MODE,
            existing_prompt="",
            new_prompt="Goals",
            channels_changed=False,
            existing_trigger=None,
            effective_trigger=TRIGGER_MESSAGE_CURSOR,
        )
        is True
    )


def test_agent_schedule_trigger_does_not_use_cursor_policy() -> None:
    assert (
        should_reset_project_message_cursor(
            existing_mode=AGENT_MODE,
            effective_mode=AGENT_MODE,
            existing_prompt="a",
            new_prompt="b",
            channels_changed=True,
            existing_trigger=TRIGGER_SCHEDULE,
            effective_trigger=TRIGGER_SCHEDULE,
        )
        is False
    )
