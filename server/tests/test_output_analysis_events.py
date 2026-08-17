"""All-mode intelligence gate: ``task_writes_analysis_events`` + persist defaults."""

from __future__ import annotations

from server.domain.analysis_modes import task_writes_analysis_events


def test_intel_event_follows_the_column() -> None:
    assert task_writes_analysis_events({"analysis_mode": "intel_event", "output_analysis_events": 1})
    assert not task_writes_analysis_events({"analysis_mode": "intel_event", "output_analysis_events": 0})


def test_leaderboard_never_writes_analysis_events() -> None:
    from server.domain.analysis_modes import task_persists_findings

    assert not task_writes_analysis_events({"analysis_mode": "leaderboard", "output_analysis_events": True})
    assert not task_writes_analysis_events({"analysis_mode": "leaderboard", "output_analysis_events": 0})
    assert task_persists_findings({"analysis_mode": "leaderboard", "output_analysis_events": 0})
    assert task_persists_findings({"analysis_mode": "leaderboard", "output_analysis_events": 1})


def test_agent_requires_mode_and_column() -> None:
    assert task_writes_analysis_events({"analysis_mode": "agent", "output_analysis_events": 1})
    assert not task_writes_analysis_events({"analysis_mode": "agent", "output_analysis_events": 0})
    assert not task_writes_analysis_events({"analysis_mode": "intel_event", "output_analysis_events": None})
    assert not task_writes_analysis_events(None)
