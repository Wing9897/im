"""Resolve per-task analysis-scheduling fields.

Optional columns mean "follow global" (AI Settings → Analysis scheduling)
when NULL, except task-owned fields:
- ``batch_overlap_count`` (event): NULL → 0
- ``agent_wave_interval_seconds`` (agent): NULL → 20
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from server.config import get_config, get_config_int
from server.db.database import Database
from server.domain.analysis_strategy_modes import ALLOWED_ANALYSIS_STRATEGY_MODES

ALLOWED_STRATEGY_MODES = ALLOWED_ANALYSIS_STRATEGY_MODES

DEFAULT_BATCH_OVERLAP_COUNT = 0
DEFAULT_AGENT_WAVE_INTERVAL_SECONDS = 20

# Shared clamp / Pydantic ranges (task_helpers Field ge/le + resolve clamps).
AGENT_WAVE_INTERVAL_MIN = 0
AGENT_WAVE_INTERVAL_MAX = 600
BATCH_OVERLAP_MIN = 0
BATCH_OVERLAP_MAX = 10
ANALYSIS_THRESHOLD_MIN = 1
ANALYSIS_THRESHOLD_MAX = 500
ANALYSIS_BATCH_LIMIT_MIN = 1
ANALYSIS_BATCH_LIMIT_MAX = 500


def _optional_int(row: Mapping[str, Any], key: str) -> int | None:
    raw = row.get(key)
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _optional_strategy(row: Mapping[str, Any]) -> str | None:
    raw = row.get("analysis_strategy_mode")
    if raw is None:
        return None
    mode = str(raw).strip()
    if not mode or mode not in ALLOWED_STRATEGY_MODES:
        return None
    return mode


def resolve_agent_wave_interval_seconds(task: Mapping[str, Any]) -> int:
    """Project-task wave cool-down; NULL / missing → 20 (no global setting)."""
    override = _optional_int(task, "agent_wave_interval_seconds")
    if override is not None:
        return max(AGENT_WAVE_INTERVAL_MIN, min(override, AGENT_WAVE_INTERVAL_MAX))
    return DEFAULT_AGENT_WAVE_INTERVAL_SECONDS


async def resolve_batch_message_limit(db: Database, task: Mapping[str, Any]) -> int:
    override = _optional_int(task, "analysis_batch_message_limit")
    if override is not None:
        return max(ANALYSIS_BATCH_LIMIT_MIN, min(override, ANALYSIS_BATCH_LIMIT_MAX))
    return await get_config_int(db, "analysis_batch_message_limit")


async def resolve_trigger_threshold(db: Database, task: Mapping[str, Any]) -> int:
    override = _optional_int(task, "analysis_trigger_threshold")
    if override is not None:
        return max(ANALYSIS_THRESHOLD_MIN, min(override, ANALYSIS_THRESHOLD_MAX))
    return await get_config_int(db, "analysis_trigger_threshold")


def resolve_batch_overlap_count(task: Mapping[str, Any]) -> int:
    """Task-owned overlap for event batches; NULL / missing → 0 (no overlap)."""
    override = _optional_int(task, "batch_overlap_count")
    if override is not None:
        return max(BATCH_OVERLAP_MIN, min(override, BATCH_OVERLAP_MAX))
    return DEFAULT_BATCH_OVERLAP_COUNT


async def resolve_strategy_mode(db: Database, task: Mapping[str, Any]) -> str:
    override = _optional_strategy(task)
    if override is not None:
        return override
    mode = (await get_config(db, "analysis_strategy_mode")).strip()
    if mode in ALLOWED_STRATEGY_MODES:
        return mode
    return "balanced"
