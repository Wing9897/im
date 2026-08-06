"""Unit tests for AgentTaskSpec normalization / presets."""

from __future__ import annotations

import pytest

from server.domain.agent_task_spec import (
    AgentTaskSpecError,
    agent_preset_spec,
    normalize_agent_task_spec,
)


def test_project_reconcile_preset():
    spec = agent_preset_spec("project_reconcile", has_channels=True)
    assert spec.trigger_mode == "message_cursor"
    assert spec.output_calendar is True
    assert spec.output_analysis_events is False
    assert spec.cap_calendar_writes is True
    assert spec.user_event_origin() == "project"


def test_web_scout_preset_schedule_without_channels():
    spec = agent_preset_spec("web_scout", has_channels=False)
    assert spec.trigger_mode == "schedule"
    assert spec.output_analysis_events is True
    assert spec.cap_force_web_search is True
    assert spec.user_event_origin() == "project"


def test_web_scout_preset_threshold_with_channels():
    spec = agent_preset_spec("web_scout", has_channels=True)
    assert spec.trigger_mode == "message_threshold"


def test_requires_at_least_one_output():
    with pytest.raises(AgentTaskSpecError, match="output"):
        normalize_agent_task_spec(
            trigger_mode="schedule",
            output_calendar=False,
            output_analysis_events=False,
        )


def test_output_calendar_forces_writes():
    spec = normalize_agent_task_spec(
        trigger_mode="schedule",
        cap_calendar_writes=False,
        output_calendar=True,
        output_analysis_events=False,
    )
    assert spec.cap_calendar_writes is True


def test_force_search_ties_to_web_search():
    spec = normalize_agent_task_spec(
        trigger_mode="schedule",
        cap_web_search=False,
        cap_force_web_search=True,
        output_analysis_events=True,
    )
    assert spec.cap_web_search is True
    assert spec.cap_force_web_search is True


def test_web_search_ties_force_on():
    spec = normalize_agent_task_spec(
        trigger_mode="schedule",
        cap_web_search=True,
        cap_force_web_search=False,
        output_analysis_events=True,
    )
    assert spec.cap_web_search is True
    assert spec.cap_force_web_search is True


def test_read_caps_default_on():
    spec = normalize_agent_task_spec(
        trigger_mode="schedule",
        output_analysis_events=True,
    )
    assert spec.cap_read_analysis_events is True
    assert spec.cap_read_items is True
    assert spec.cap_calendar_read is True


def test_read_caps_can_disable():
    spec = normalize_agent_task_spec(
        trigger_mode="schedule",
        output_analysis_events=True,
        cap_calendar_read=False,
        cap_read_analysis_events=False,
        cap_read_items=False,
    )
    assert spec.cap_calendar_read is False
    assert spec.cap_read_analysis_events is False
    assert spec.cap_read_items is False


def test_message_cursor_requires_channels():
    with pytest.raises(AgentTaskSpecError, match="message_cursor"):
        normalize_agent_task_spec(
            trigger_mode="message_cursor",
            output_calendar=True,
            has_channels=False,
        )


def test_message_threshold_without_channels_becomes_schedule():
    spec = normalize_agent_task_spec(
        trigger_mode="message_threshold",
        output_analysis_events=True,
        has_channels=False,
    )
    assert spec.trigger_mode == "schedule"
