"""Non-agent ``agent_policy_write_fields`` persists only ``output_analysis_events``."""

from __future__ import annotations

from server.api.routes.task_helpers import agent_policy_write_fields
from server.api.schemas.requests.tasks import TaskConfigBody

_AGENT_POLICY_COLUMNS = {
    "trigger_mode",
    "cap_calendar_read",
    "cap_calendar_writes",
    "cap_web_search",
    "cap_force_web_search",
    "cap_read_analysis_events",
    "cap_read_items",
    "output_calendar",
    "output_analysis_events",
}


def test_non_agent_create_writes_only_output_analysis_events_on() -> None:
    body = TaskConfigBody(name="intel")
    fields = agent_policy_write_fields(effective_mode="intel_event", body=body)
    assert fields == {"output_analysis_events": 1}
    assert set(fields).isdisjoint(_AGENT_POLICY_COLUMNS - {"output_analysis_events"})


def test_leaderboard_create_defaults_output_analysis_events_off() -> None:
    body = TaskConfigBody(name="board")
    fields = agent_policy_write_fields(effective_mode="leaderboard", body=body)
    assert fields == {"output_analysis_events": 0}


def test_non_agent_persists_output_analysis_events_off() -> None:
    body = TaskConfigBody(name="intel", outputAnalysisEvents=False)
    fields = agent_policy_write_fields(effective_mode="leaderboard", body=body)
    assert fields == {"output_analysis_events": 0}


def test_non_agent_update_keeps_existing_output_analysis_events() -> None:
    body = TaskConfigBody(name="intel")
    fields = agent_policy_write_fields(
        effective_mode="intel_event",
        body=body,
        existing={"output_analysis_events": 0},
    )
    assert fields == {"output_analysis_events": 0}


def test_agent_path_still_returns_full_policy_spec() -> None:
    body = TaskConfigBody(
        name="agent",
        promptTemplate="Reconcile",
        analysisMode="agent",
        triggerMode="schedule",
        outputCalendar=False,
        outputAnalysisEvents=True,
    )
    fields = agent_policy_write_fields(effective_mode="agent", body=body, has_channels=False)
    assert set(fields) == _AGENT_POLICY_COLUMNS
    assert fields["output_analysis_events"] == 1
    assert fields["output_calendar"] == 0
    assert fields["trigger_mode"] == "schedule"
