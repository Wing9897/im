"""Scheduled tick for ``analysis_mode=web_intel``.

Pipeline (per fire):
- Optional message gate (channels bound): threshold → claim markers → inject
  source messages into Agent context (same helpers as event message-batch).
- No channels: pure timed Agent fire (keywords from task prompt).
- ``AgentRuntime.chat`` on ``web_intel`` channel (force ``web.search``, no
  calendar writes) → parse final event JSON → ``store_results``.

Failure semantics (intentional vs message-batch):
- Keep ``completed`` + ``error_message`` (not ``pending`` / marker retry).
- Log via ``record_batch_failure``; SSE includes ``analysisMode`` / ``retrying``.
- Consecutive failed fires reaching ``max_batch_retries`` set ``is_active=false``
  (task-local fuse; not global analysis pause). Successful fires clear the streak.
"""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, Any

from server.agent.runtime import AgentRuntime
from server.agent.web_search_routing import resolve_web_search_route
from server.analyzer.incremental import fetch_unanalyzed_messages
from server.analyzer.llm_client import ConfigurableLlmClient, load_llm_config
from server.analyzer.llm_json import normalize_items, parse_json_response
from server.analyzer.prompt import format_messages
from server.app_logging import failure_details_from_exc
from server.config import get_config, get_config_bool, get_config_int
from server.db.database import Database
from server.domain.analysis_modes import WEB_INTEL_MODE
from server.prompts.web_intel import build_web_intel_base_prompt, build_web_intel_seed_message
from server.scheduler.batch_claim import (
    batch_channel_names,
    create_batch_with_markers,
    fetch_batch_messages,
    load_task,
    task_has_channels,
)
from server.scheduler.result_store import store_results
from server.scheduler.task_schedule_overrides import (
    resolve_batch_message_limit,
    resolve_trigger_threshold,
)
from server.scheduler.under_threshold_skip import note_under_threshold_skip
from server.scheduler.web_intel_batches import (
    complete_web_intel_failure,
    open_processing_batch,
    record_web_intel_skip,
)
from server.sse import Broadcaster
from server.util import utc_now_iso

if TYPE_CHECKING:
    from server.scheduler.manager import SchedulerManager

logger = logging.getLogger(__name__)

_SKIP_EMPTY_PROMPT = "skipped: empty prompt_template"
DEFAULT_WEB_INTEL_MAX_TOOL_ROUNDS = 8


def parse_web_intel_agent_items(final_message: str) -> list[dict[str, Any]]:
    """Parse Agent final text into analysis-event item dicts."""
    text = (final_message or "").strip()
    if not text:
        return []
    parsed = parse_json_response(text)
    # Nested: {"message": "{\"items\":[...]}"} already unwrapped by runtime → text.
    # Also accept {"message": "...", "items": [...]} if a model emits both.
    if isinstance(parsed, dict) and "items" not in parsed:
        nested = parsed.get("message")
        if isinstance(nested, str) and nested.strip():
            try:
                parsed = parse_json_response(nested)
            except ValueError:
                pass
    return [item for item in normalize_items(parsed) if isinstance(item, dict)]


async def _claim_messages_for_gate(
    db: Database,
    task: dict[str, Any],
) -> tuple[str, list[dict[str, Any]]] | None:
    """Threshold gate + marker claim. ``None`` = quiet skip (under threshold)."""
    effective_limit = await resolve_batch_message_limit(db, task)
    effective_threshold = await resolve_trigger_threshold(db, task)
    messages = await fetch_unanalyzed_messages(db, task, limit_override=effective_limit)
    if not messages or len(messages) < effective_threshold:
        await note_under_threshold_skip(
            db,
            task_id=str(task.get("id") or ""),
            task_name=str(task.get("name") or ""),
            message_count=len(messages or []),
            threshold=effective_threshold,
            source="server.scheduler.web_intel_tick",
        )
        return None
    batch_id = await create_batch_with_markers(db, task, messages)
    now = utc_now_iso()
    await db.execute(
        "UPDATE analysis_batches SET status = 'processing', updated_at = ? WHERE id = ?",
        (now, batch_id),
    )
    claimed = await fetch_batch_messages(db, batch_id)
    return batch_id, claimed


async def execute_web_intel_tick(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task_id: str,
    analysis_paused: bool | None = None,
    scheduler: SchedulerManager | None = None,
) -> None:
    """Run one web-intel schedule fire (Agent multi-round; optional message gate)."""
    if analysis_paused is None:
        analysis_paused = await get_config_bool(db, "analysis_paused")
    if analysis_paused:
        return

    task = await load_task(db, task_id)
    if task is None or not task.get("is_active"):
        return
    if str(task.get("analysis_mode") or "") != WEB_INTEL_MODE:
        return

    prompt_template = str(task.get("prompt_template") or "").strip()
    task_name = str(task.get("name") or "")
    version = int(task.get("version") or 1)

    if not prompt_template:
        await record_web_intel_skip(
            db=db,
            broadcaster=broadcaster,
            task=task,
            task_id=task_id,
            reason=_SKIP_EMPTY_PROMPT,
        )
        return

    has_channels = await task_has_channels(db, task_id)
    claimed_messages: list[dict[str, Any]] = []
    batch_id: str

    if has_channels:
        claimed = await _claim_messages_for_gate(db, task)
        if claimed is None:
            # Align with event: under threshold → quiet skip (no LLM, no batch).
            return
        batch_id, claimed_messages = claimed
    else:
        batch_id = await open_processing_batch(db, task=task, message_count=0)

    llm_cfg = await load_llm_config(db)
    # Scheduled web_intel always searches; only the provider/native path is shared
    # with assistant settings. The assistant master switch must not pause ticks.
    route = resolve_web_search_route(
        web_search_enabled=True,
        web_search_provider=await get_config(db, "web_search_provider"),
        llm_provider=llm_cfg["provider"],
        llm_base_url=llm_cfg["base_url"],
    )

    broadcaster.publish(
        "analysis_started",
        {
            "taskId": task_id,
            "taskName": task_name,
            "batchId": batch_id,
            "messageCount": len(claimed_messages),
            "estimatedTokens": 0,
            "llmProvider": llm_cfg["provider"],
            "llmModel": llm_cfg["model"],
            "webSearchMode": route.mode,
            "analysisMode": WEB_INTEL_MODE,
        },
    )

    llm_timeout = await get_config_int(db, "llm_generation_timeout")
    ui_locale = await get_config(db, "ui_locale")
    source_text = format_messages(claimed_messages) if claimed_messages else None
    seed = build_web_intel_seed_message(
        task_name=task_name,
        task_id=task_id,
        source_messages_text=source_text,
    )
    pinned = build_web_intel_base_prompt(prompt_template)

    client: ConfigurableLlmClient | None = None
    items: list[dict[str, Any]] = []
    used_mode = route.mode
    try:
        client = await ConfigurableLlmClient.from_db_for_agent(db)
        runtime = AgentRuntime(
            db,
            client,
            max_tool_rounds=DEFAULT_WEB_INTEL_MAX_TOOL_ROUNDS,
            broadcaster=broadcaster,
        )
        result = await asyncio.wait_for(
            runtime.chat(
                [{"role": "user", "content": seed}],
                locale=ui_locale,
                channel="web_intel",
                base_prompt=pinned,
            ),
            timeout=max(int(llm_timeout) * 2, 1),
        )
        raw_message = result.get("message")
        final_text = raw_message if isinstance(raw_message, str) else ""
        items = parse_web_intel_agent_items(final_text)
        tool_calls = result.get("toolCalls") or []
        if isinstance(tool_calls, list) and any(
            isinstance(call, dict) and str(call.get("name") or "").startswith("web.") for call in tool_calls
        ):
            used_mode = f"agent:{route.mode}"
        else:
            used_mode = f"agent:{route.mode}:no_web_tool"
    except Exception as exc:  # noqa: BLE001 — complete batch as error; next fire retries
        logger.exception("web_intel tick failed task=%s batch=%s", task_id, batch_id)
        await complete_web_intel_failure(
            db=db,
            broadcaster=broadcaster,
            task_id=task_id,
            task_name=task_name,
            batch_id=batch_id,
            version=version,
            error_message=str(exc),
            scheduler=scheduler,
            failure_details=failure_details_from_exc(exc),
        )
        return
    finally:
        if client is not None:
            await client.close()

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
        except Exception as exc:  # noqa: BLE001
            logger.warning("Geocoding skipped for web_intel batch %s: %s", batch_id, exc)

    channel_names = await batch_channel_names(db, batch_id) if claimed_messages else []
    done = utc_now_iso()
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
            "completion_tokens = ?, error_message = NULL, message_count = ?, "
            "updated_at = ?, completed_at = ? WHERE id = ?",
            (0, 0, len(claimed_messages), done, done, batch_id),
        )

    # Successful tick clears consecutive-failure streak (DB-derived: null error_message).
    broadcaster.publish(
        "analysis_completed",
        {
            "taskId": task_id,
            "batchId": batch_id,
            "analysisMode": WEB_INTEL_MODE,
            "findingsCount": findings_count,
            "hasFindings": findings_count > 0,
            "webSearchMode": used_mode,
            "messageCount": len(claimed_messages),
        },
    )
