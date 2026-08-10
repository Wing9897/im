"""Unit tests for per-task analysis-scheduling override resolution."""

from __future__ import annotations

import pytest

from server.config import set_configs
from server.scheduler.task_schedule_overrides import (
    resolve_agent_wave_interval_seconds,
    resolve_batch_message_limit,
    resolve_batch_overlap_count,
    resolve_strategy_mode,
    resolve_trigger_threshold,
)


def test_resolve_project_wave_is_task_owned() -> None:
    assert resolve_agent_wave_interval_seconds({"agent_wave_interval_seconds": 7}) == 7
    assert resolve_agent_wave_interval_seconds({"agent_wave_interval_seconds": None}) == 20
    assert resolve_agent_wave_interval_seconds({}) == 20
    assert resolve_agent_wave_interval_seconds({"agent_wave_interval_seconds": 900}) == 600
    assert resolve_agent_wave_interval_seconds({"agent_wave_interval_seconds": -1}) == 0


@pytest.mark.asyncio
async def test_resolve_batch_overrides_prefer_task_then_global(app) -> None:
    db = app.state.db
    await set_configs(
        db,
        {
            "analysis_batch_message_limit": "50",
            "analysis_trigger_threshold": "50",
            "analysis_strategy_mode": "balanced",
        },
    )
    task = {
        "analysis_batch_message_limit": 12,
        "analysis_trigger_threshold": 3,
        "batch_overlap_count": 4,
        "analysis_strategy_mode": "aggressive",
    }
    assert await resolve_batch_message_limit(db, task) == 12
    assert await resolve_trigger_threshold(db, task) == 3
    assert resolve_batch_overlap_count(task) == 4
    assert await resolve_strategy_mode(db, task) == "aggressive"

    empty = {
        "analysis_batch_message_limit": None,
        "analysis_trigger_threshold": None,
        "batch_overlap_count": None,
        "analysis_strategy_mode": None,
    }
    assert await resolve_batch_message_limit(db, empty) == 50
    assert await resolve_trigger_threshold(db, empty) == 50
    assert resolve_batch_overlap_count(empty) == 0
    assert await resolve_strategy_mode(db, empty) == "balanced"


def test_resolve_batch_overlap_is_task_owned() -> None:
    assert resolve_batch_overlap_count({"batch_overlap_count": 7}) == 7
    assert resolve_batch_overlap_count({"batch_overlap_count": None}) == 0
    assert resolve_batch_overlap_count({}) == 0
    assert resolve_batch_overlap_count({"batch_overlap_count": 99}) == 10
    assert resolve_batch_overlap_count({"batch_overlap_count": -3}) == 0
