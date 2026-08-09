"""Unified scheduled tick for ``analysis_mode=agent``.

Trigger modes:
- ``message_cursor`` — skip LLM when no new messages; multi-wave drain
- ``message_threshold`` — channel-bound threshold gate (else quiet skip)
- ``schedule`` — pure timed fire

Policy (tools / outputs / origin) comes from ``AgentTaskSpec`` on the task row.

Heavy paths live in ``agent_tick_cursor`` / ``agent_tick_schedule``;
format helpers in ``agent_tick_format``; wave/drain in ``agent_tick_wave`` /
``agent_tick_drain``.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from server.config import get_config_bool
from server.db.database import Database
from server.domain.agent_task_spec import (
    TRIGGER_MESSAGE_CURSOR,
    AgentTaskSpecError,
    agent_task_spec_from_row,
)
from server.domain.analysis_modes import AGENT_MODE
from server.scheduler.agent_tick_cursor import run_cursor_drain
from server.scheduler.agent_tick_format import (
    DEFAULT_AGENT_MAX_DRAIN_WAVES,
    DEFAULT_AGENT_MAX_TOOL_ROUNDS,
    DEFAULT_AGENT_MAX_TOOL_ROUNDS_CURSOR,
    MESSAGE_SUMMARY_LIMIT,
    build_agent_tick_seed,
    parse_agent_items,
    serialize_tick_tool_calls,
)
from server.scheduler.agent_tick_schedule import run_schedule_or_threshold
from server.scheduler.batch_claim import load_task, task_has_channels
from server.sse import Broadcaster

if TYPE_CHECKING:
    from server.scheduler.manager import SchedulerManager

logger = logging.getLogger(__name__)


async def execute_agent_tick(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task_id: str,
    analysis_paused: bool | None = None,
    scheduler: SchedulerManager | None = None,
) -> None:
    """Run one agent schedule fire according to the task's AgentTaskSpec."""
    if analysis_paused is None:
        analysis_paused = await get_config_bool(db, "analysis_paused")
    if analysis_paused:
        return

    task = await load_task(db, task_id)
    if task is None or not task.get("is_active"):
        return
    if str(task.get("analysis_mode") or "") != AGENT_MODE:
        return

    has_channels = await task_has_channels(db, task_id)
    try:
        spec = agent_task_spec_from_row(task, has_channels=has_channels)
    except AgentTaskSpecError as exc:
        logger.warning("Agent tick %s skipped: invalid policy (%s)", task_id, exc)
        return

    if spec.trigger_mode == TRIGGER_MESSAGE_CURSOR:
        await run_cursor_drain(
            db=db,
            broadcaster=broadcaster,
            task=task,
            task_id=task_id,
            spec=spec,
        )
        return

    await run_schedule_or_threshold(
        db=db,
        broadcaster=broadcaster,
        task=task,
        task_id=task_id,
        spec=spec,
        scheduler=scheduler,
    )


__all__ = [
    "DEFAULT_AGENT_MAX_DRAIN_WAVES",
    "DEFAULT_AGENT_MAX_TOOL_ROUNDS",
    "DEFAULT_AGENT_MAX_TOOL_ROUNDS_CURSOR",
    "MESSAGE_SUMMARY_LIMIT",
    "build_agent_tick_seed",
    "execute_agent_tick",
    "parse_agent_items",
    "serialize_tick_tool_calls",
]
