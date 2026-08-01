"""Unit tests for soft project-cursor reset policy."""

from __future__ import annotations

from server.domain.analysis_modes import LEADERBOARD_MODE, PARENT_PROJECT_MODE
from server.services.task_writes import should_reset_project_message_cursor


def test_schedule_only_edit_keeps_cursor() -> None:
    assert (
        should_reset_project_message_cursor(
            existing_mode=PARENT_PROJECT_MODE,
            effective_mode=PARENT_PROJECT_MODE,
            existing_prompt="Keep demos",
            new_prompt="Keep demos",
            channels_changed=False,
        )
        is False
    )


def test_prompt_change_resets_cursor() -> None:
    assert (
        should_reset_project_message_cursor(
            existing_mode=PARENT_PROJECT_MODE,
            effective_mode=PARENT_PROJECT_MODE,
            existing_prompt="Keep demos",
            new_prompt="New goals",
            channels_changed=False,
        )
        is True
    )


def test_channel_rebinding_resets_cursor() -> None:
    assert (
        should_reset_project_message_cursor(
            existing_mode=PARENT_PROJECT_MODE,
            effective_mode=PARENT_PROJECT_MODE,
            existing_prompt="Keep demos",
            new_prompt="Keep demos",
            channels_changed=True,
        )
        is True
    )


def test_leaving_project_resets_cursor() -> None:
    assert (
        should_reset_project_message_cursor(
            existing_mode=PARENT_PROJECT_MODE,
            effective_mode=LEADERBOARD_MODE,
            existing_prompt="Keep demos",
            new_prompt="Keep demos",
            channels_changed=False,
        )
        is True
    )


def test_entering_project_resets_cursor() -> None:
    assert (
        should_reset_project_message_cursor(
            existing_mode=LEADERBOARD_MODE,
            effective_mode=PARENT_PROJECT_MODE,
            existing_prompt="",
            new_prompt="Goals",
            channels_changed=False,
        )
        is True
    )
