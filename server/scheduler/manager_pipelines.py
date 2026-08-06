"""Mode → pipeline routing for scheduled task execution.

Keeps ``SchedulerManager`` focused on capacity / registration / lifecycle;
this module owns which tick/batch entry runs for a given ``analysis_mode``.
"""

from __future__ import annotations

from typing import Any

from server.db.database import Database
from server.domain.analysis_modes import get_analysis_mode_spec
from server.scheduler.agent_tick import execute_agent_tick
from server.scheduler.batch import execute_batch
from server.sse import SseBroadcaster


async def run_scheduled_pipeline(
    *,
    db: Database,
    broadcaster: SseBroadcaster,
    task_id: str,
    analysis_engine: Any,
    action_executor: Any,
    analysis_paused: bool,
    scheduler: Any,
) -> None:
    """Dispatch one acquired capacity slot to the mode's pipeline."""
    row = await db.fetch_one(
        "SELECT analysis_mode FROM analysis_tasks WHERE id = ?",
        (task_id,),
    )
    mode = str((row or {}).get("analysis_mode") or "")
    spec = get_analysis_mode_spec(mode)
    if spec is not None and spec.pipeline == "agent_tick":
        await execute_agent_tick(
            db=db,
            broadcaster=broadcaster,
            task_id=task_id,
            analysis_paused=analysis_paused,
            scheduler=scheduler,
        )
    else:
        await execute_batch(
            db=db,
            broadcaster=broadcaster,
            task_id=task_id,
            analysis_engine=analysis_engine,
            action_executor=action_executor,
            analysis_paused=analysis_paused,
            scheduler=scheduler,
        )
