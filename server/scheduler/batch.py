"""One analysis batch: claim → prompt → LLM (lock-free) → persist → notify.

Invariants:
- Messages are claimed by inserting markers when the batch is created, so a
  retried batch reprocesses exactly its own message set (marker join).
- The LLM call happens with no transaction open.
- Results + batch completion are written in a single transaction.
- Permanent failure deletes the batch's markers so messages re-qualify.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional, Protocol

from server.analyzer.incremental import fetch_unanalyzed_messages
from server.analyzer.leaderboard import load_leaderboard_context
from server.analyzer.overlap import fetch_overlap_context
from server.analyzer.prompt import build_analysis_prompt
from server.app_logging import failure_details_from_exc, record
from server.config import get_config, get_config_bool, get_config_int
from server.db.database import Database
from server.domain.analysis_modes import INTEL_EVENT_MODE, LEADERBOARD_MODE, MESSAGE_BATCH_ANALYSIS_MODES
from server.scheduler.batch_claim import (
    batch_channel_names,
    create_batch_with_markers,
    fetch_batch_messages,
    find_pending_batch,
    load_task,
    task_has_channels,
)
from server.scheduler.batch_failure import handle_batch_failure
from server.scheduler.result_store import store_results
from server.scheduler.task_schedule_overrides import (
    resolve_batch_message_limit,
    resolve_batch_overlap_count,
    resolve_strategy_mode,
    resolve_trigger_threshold,
)
from server.sse import Broadcaster
from server.util import utc_now_iso

logger = logging.getLogger(__name__)


class Engine(Protocol):
    """What execute_batch needs from the analysis engine."""

    provider: str
    model: str

    async def analyze(self, prompt: Any) -> dict[str, Any]: ...


async def execute_batch(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task_id: str,
    analysis_engine: Engine,
    action_executor: Any = None,
    analysis_paused: bool | None = None,
    scheduler: Any = None,
) -> None:
    """Dispatch entry point: pre-checks, claim (or resume), process."""
    if analysis_paused is None:
        analysis_paused = await get_config_bool(db, "analysis_paused")
    if analysis_paused:
        return

    task = await load_task(db, task_id)
    if task is None or not task.get("is_active"):
        return
    if task.get("analysis_mode") not in MESSAGE_BATCH_ANALYSIS_MODES:
        return
    if not await task_has_channels(db, task_id):
        return

    version = int(task.get("version") or 1)

    # Resume an existing pending batch (crash recovery / retriable failure).
    batch = await find_pending_batch(db, task_id, version)
    if batch is None:
        effective_limit = await resolve_batch_message_limit(db, task)
        effective_threshold = await resolve_trigger_threshold(db, task)

        messages = await fetch_unanalyzed_messages(db, task, limit_override=effective_limit)
        if not messages or len(messages) < effective_threshold:
            return
        batch_id = await create_batch_with_markers(db, task, messages)
    else:
        batch_id = str(batch["id"])

    await _process_batch(
        db=db,
        broadcaster=broadcaster,
        task=task,
        batch_id=batch_id,
        analysis_engine=analysis_engine,
        action_executor=action_executor,
        scheduler=scheduler,
    )


async def _process_batch(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task: dict[str, Any],
    batch_id: str,
    analysis_engine: Engine,
    action_executor: Any,
    scheduler: Any = None,
) -> None:
    task_id = str(task["id"])
    task_name = str(task.get("name") or "")
    analysis_mode = str(task.get("analysis_mode") or INTEL_EVENT_MODE)

    messages = await fetch_batch_messages(db, batch_id)
    if not messages:
        # Nothing claimed (markers vanished, e.g. retention) — close the batch.
        now = utc_now_iso()
        await db.execute(
            "UPDATE analysis_batches SET status = 'completed', updated_at = ?, completed_at = ? WHERE id = ?",
            (now, now, batch_id),
        )
        return

    overlap_count = resolve_batch_overlap_count(task)
    overlap_messages = await fetch_overlap_context(db, task, overlap_count)
    leaderboard_context = await load_leaderboard_context(db, task)

    max_tokens = await get_config_int(db, "analysis_max_estimated_input_tokens")
    max_total_chars = await get_config_int(db, "analysis_max_total_chars")
    strategy_mode = await resolve_strategy_mode(db, task)
    ui_locale = await get_config(db, "ui_locale")

    prompt = build_analysis_prompt(
        prompt_template=str(task.get("prompt_template") or ""),
        analysis_mode=analysis_mode,
        primary_messages=messages,
        overlap_messages=overlap_messages,
        leaderboard_context=leaderboard_context,
        max_tokens=max_tokens,
        max_total_chars=max_total_chars,
        strategy_mode=strategy_mode or None,
        ui_locale=ui_locale,
    )

    if await get_config_bool(db, "analysis_trace_verbose"):
        short_batch = f"{batch_id[:8]}…" if len(batch_id) > 8 else batch_id
        strategy = strategy_mode or "standard"
        trace_summary = (
            f"{task_name} ({short_batch})"
            f" mode={analysis_mode} strategy={strategy}"
            f" messages={len(messages)}"
            f" tokens≈{prompt.estimated_tokens}"
        )
        logger.info(
            "analysis trace task=%s batch=%s mode=%s strategy=%s "
            "messages=%s tokens=%s overlap_used=%s primary_used=%s",
            task_id,
            batch_id,
            analysis_mode,
            strategy,
            len(messages),
            prompt.estimated_tokens,
            prompt.overlap_used_count,
            prompt.primary_used_count,
        )
        await record(
            db,
            level="info",
            category="analysis",
            kind="analysis.trace",
            message=f"Analysis trace: {trace_summary}",
            message_key="logs:templates.analysisTrace",
            message_params={
                "summary": trace_summary,
                "taskName": task_name,
                "shortBatch": short_batch,
                "analysisMode": analysis_mode,
                "strategyMode": strategy,
                "messageCount": len(messages),
                "estimatedTokens": prompt.estimated_tokens,
            },
            source="server.scheduler.batch",
            payload={
                "taskId": task_id,
                "taskName": task_name,
                "batchId": batch_id,
                "analysisMode": analysis_mode,
                "strategyMode": strategy,
                "messageCount": len(messages),
                "estimatedTokens": prompt.estimated_tokens,
                "overlapUsedCount": prompt.overlap_used_count,
                "primaryUsedCount": prompt.primary_used_count,
            },
        )

    now = utc_now_iso()
    # Compare-and-set on 'pending': the claim is what makes this dispatcher the
    # only owner of the batch. Without the guard two overlapping dispatches for
    # the same task both entered the LLM call and stored duplicate results.
    claimed = await db.execute(
        "UPDATE analysis_batches SET status = 'processing', updated_at = ? WHERE id = ? AND status = 'pending'",
        (now, batch_id),
    )
    if claimed != 1:
        logger.info(
            "Batch %s is no longer pending; another dispatch owns it",
            batch_id,
        )
        return
    broadcaster.publish(
        "analysis_started",
        {
            "taskId": task_id,
            "taskName": task_name,
            "batchId": batch_id,
            "messageCount": len(messages),
            "estimatedTokens": prompt.estimated_tokens,
            "llmProvider": analysis_engine.provider,
            "llmModel": analysis_engine.model,
        },
    )

    # Hard wall-clock guard: the aiohttp session timeout normally handles this,
    # but a hung request must never leave the batch in 'processing' forever
    # (observed in live E2E: one batch stuck 17+ minutes past the timeout).
    llm_timeout = await get_config_int(db, "llm_generation_timeout")
    try:
        result = await asyncio.wait_for(analysis_engine.analyze(prompt), timeout=llm_timeout * 2)
    except asyncio.TimeoutError as exc:
        await handle_batch_failure(
            db=db,
            broadcaster=broadcaster,
            task_id=task_id,
            task_name=task_name,
            batch_id=batch_id,
            error_message=f"LLM call exceeded hard timeout ({llm_timeout * 2}s)",
            scheduler=scheduler,
            failure_details=failure_details_from_exc(exc),
        )
        return
    except Exception as exc:  # noqa: BLE001 — all LLM/parse errors route to failure policy
        await handle_batch_failure(
            db=db,
            broadcaster=broadcaster,
            task_id=task_id,
            task_name=task_name,
            batch_id=batch_id,
            error_message=str(exc),
            scheduler=scheduler,
            failure_details=failure_details_from_exc(exc),
        )
        return

    items = result["items"]
    # Geocode (or apply 0,0 sentinel) for any item missing coordinates.
    needs_geocode = [
        item
        for item in items
        if isinstance(item, dict) and item.get("latitude") is None and item.get("longitude") is None
    ]
    if needs_geocode:
        from server.analyzer.geocoding import geocode_analysis_items

        for item in items:
            if isinstance(item, dict):
                item.setdefault("latitude", None)
                item.setdefault("longitude", None)
        try:
            items = await geocode_analysis_items(items)
        except Exception as exc:  # noqa: BLE001 — geocoding must not fail the batch
            logger.warning("Geocoding skipped for batch %s: %s", batch_id, exc)

    channel_names = await batch_channel_names(db, batch_id)
    now = utc_now_iso()
    async with db.transaction() as conn:
        findings_count = await store_results(
            conn,
            task=task,
            batch_id=batch_id,
            items=items,
            channel_names=channel_names,
        )
        await conn.execute(
            "UPDATE analysis_batches SET status = 'completed', prompt_tokens = ?, "
            "completion_tokens = ?, error_message = NULL, updated_at = ?, "
            "completed_at = ? WHERE id = ?",
            (
                result["prompt_tokens"],
                result["completion_tokens"],
                now,
                now,
                batch_id,
            ),
        )

    broadcaster.publish(
        "analysis_completed",
        {
            "taskId": task_id,
            "batchId": batch_id,
            "analysisMode": analysis_mode,
            "findingsCount": findings_count,
            "hasFindings": findings_count > 0,
            "overlapStatistics": prompt.overlap_statistics,
        },
    )

    if action_executor is not None:
        max_score = _max_score(items) if analysis_mode == LEADERBOARD_MODE else None
        try:
            await action_executor.trigger_for_completion(
                task_id=task_id,
                task_name=task_name,
                batch_id=batch_id,
                analysis_mode=analysis_mode,
                findings_count=findings_count,
                max_score=max_score,
            )
        except Exception:  # noqa: BLE001 — actions must not fail the batch
            logger.exception("Action trigger evaluation failed for batch %s", batch_id)


def _max_score(items: list[dict[str, Any]]) -> Optional[float]:
    scores = []
    for item in items:
        if isinstance(item, dict) and item.get("score") is not None:
            try:
                scores.append(float(item["score"]))
            except (TypeError, ValueError):
                continue
    return max(scores) if scores else None
