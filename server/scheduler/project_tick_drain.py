"""Drain-wave loop for agent ``message_cursor`` ticks.

``_run_one_wave`` (in ``project_tick_wave``) runs one AgentRuntime chat page;
``drain_project_waves`` loops until the backlog is empty or pause / disable /
optional wave-cap / timeout stops the fire.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

from server.agent.channels import AgentChannel
from server.agent.runtime import AgentRuntime
from server.config import get_config_bool
from server.db.database import Database
from server.domain.agent_task_spec import TRIGGER_MESSAGE_CURSOR, AgentTaskSpec, agent_task_spec_from_row
from server.domain.analysis_modes import AGENT_MODE
from server.prompts.agent_task import build_agent_base_prompt
from server.queries.project_tick_queries import (
    ProjectMessageCursor,
    fetch_project_messages_since,
    update_project_batch_message_count,
)
from server.scheduler.batch_claim import load_task
from server.scheduler.agent_tick import MESSAGE_SUMMARY_LIMIT
from server.scheduler.project_tick_wave import _run_one_wave

logger = logging.getLogger(__name__)


async def _drain_stop_reason(db: Database, task_id: str) -> str | None:
    """Return a human reason to halt before the next wave, or None to continue."""
    if await get_config_bool(db, "analysis_paused"):
        return "analysis paused / emergency stop"
    task = await load_task(db, task_id)
    if task is None:
        return "task missing"
    if not task.get("is_active"):
        return "task disabled"
    if str(task.get("analysis_mode") or "") != AGENT_MODE:
        return "task no longer in agent mode"
    if str(task.get("trigger_mode") or "") != TRIGGER_MESSAGE_CURSOR:
        return "task no longer uses message_cursor trigger"
    return None


@dataclass
class DrainOutcome:
    """Aggregated drain loop result for ``execute_agent_tick``."""

    total_messages: int = 0
    all_tool_calls: list[Any] = field(default_factory=list)
    wave_summaries: list[str] = field(default_factory=list)
    drained: bool = False
    deferred_reason: str | None = None
    cursor: ProjectMessageCursor | str | None = None


async def drain_project_waves(
    *,
    db: Database,
    runtime: AgentRuntime,
    task: dict[str, Any],
    task_id: str,
    batch_id: str,
    messages: list[dict[str, Any]],
    cursor: ProjectMessageCursor | str | None,
    max_waves: int,
    wave_interval: int,
    spec: AgentTaskSpec | None = None,
    policy: AgentChannel | None = None,
) -> DrainOutcome:
    """Drain new agent messages via Agent waves until empty or stopped."""
    unlimited = max_waves == 0
    resolved_spec = spec or agent_task_spec_from_row(task, has_channels=True)
    pinned_base_prompt = build_agent_base_prompt(
        str(task.get("prompt_template") or ""),
        resolved_spec,
    )
    carry_messages: list[dict[str, str]] = []
    session_id: str | None = None
    outcome = DrainOutcome(cursor=cursor)
    wave_index = 0

    while messages:
        if not unlimited and wave_index >= max_waves:
            outcome.deferred_reason = f"reached optional max waves ({max_waves})"
            break

        stop_reason = await _drain_stop_reason(db, task_id)
        if stop_reason is not None:
            outcome.deferred_reason = stop_reason
            break

        if wave_index > 0 and wave_interval > 0:
            logger.info(
                "Agent tick %s cooling %ss before wave %s",
                task_id,
                wave_interval,
                wave_index + 1,
            )
            await asyncio.sleep(wave_interval)
            stop_reason = await _drain_stop_reason(db, task_id)
            if stop_reason is not None:
                outcome.deferred_reason = stop_reason
                break

        wave_index += 1
        outcome.total_messages += len(messages)
        await update_project_batch_message_count(db, batch_id, outcome.total_messages)

        wave = await _run_one_wave(
            db=db,
            runtime=runtime,
            task=task,
            task_id=task_id,
            messages=messages,
            cursor=outcome.cursor,
            wave_index=wave_index,
            wave_total_hint="unlimited drain" if unlimited else f"cap {max_waves} waves",
            pinned_base_prompt=pinned_base_prompt,
            carry_messages=carry_messages,
            session_id=session_id,
            spec=resolved_spec,
            policy=policy,
        )
        session_id = wave.session_id
        outcome.cursor = wave.cursor

        if wave.timed_out:
            outcome.deferred_reason = wave.timeout_reason
            outcome.wave_summaries.append(
                f"[wave {wave_index}] stopped ({outcome.deferred_reason}); remaining backlog deferred to next schedule"
            )
            break

        if wave.agent_message.strip():
            outcome.wave_summaries.append(f"[wave {wave_index}] {wave.agent_message.strip()}")
        outcome.all_tool_calls.extend(wave.tool_calls)

        if len(messages) < MESSAGE_SUMMARY_LIMIT:
            outcome.drained = True
            break
        messages = await fetch_project_messages_since(
            db,
            task_id=task_id,
            since=outcome.cursor,
            limit=MESSAGE_SUMMARY_LIMIT,
        )

    if not outcome.drained and outcome.deferred_reason is None:
        outcome.drained = not messages

    if not outcome.drained:
        if outcome.deferred_reason is None:
            outcome.deferred_reason = "backlog remains"
        remaining = await fetch_project_messages_since(
            db,
            task_id=task_id,
            since=outcome.cursor,
            limit=1,
        )
        if remaining or outcome.deferred_reason:
            outcome.wave_summaries.append(
                f"[drain] stopped ({outcome.deferred_reason}); remaining backlog deferred to next schedule"
            )

    return outcome


__all__ = [
    "DrainOutcome",
    "_run_one_wave",
    "drain_project_waves",
]
