"""``schedule`` / ``message_threshold`` trigger paths for agent ticks."""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, Any

from server.agent.channels import channel_from_agent_spec
from server.agent.runtime import AgentRuntime
from server.agent.web_search_routing import resolve_web_search_route
from server.analyzer.incremental import fetch_unanalyzed_messages
from server.analyzer.llm_client import ConfigurableLlmClient, load_llm_config
from server.analyzer.prompt import format_messages
from server.app_logging import failure_details_from_exc
from server.config import get_config, get_config_int
from server.db.database import Database
from server.domain.agent_task_spec import TRIGGER_MESSAGE_THRESHOLD, AgentTaskSpec
from server.domain.analysis_modes import AGENT_MODE
from server.prompts.agent_task import build_agent_base_prompt, build_agent_seed_message
from server.scheduler.agent_batches import (
    complete_agent_failure,
    open_processing_batch,
    record_agent_skip,
)
from server.scheduler.agent_tick_format import (
    _AGENT_MESSAGE_LIMIT,
    _SKIP_EMPTY_PROMPT,
    DEFAULT_AGENT_MAX_TOOL_ROUNDS,
    parse_agent_items,
    serialize_tick_tool_calls,
    truncate_text,
)
from server.scheduler.batch_claim import (
    batch_channel_names,
    create_batch_with_markers,
    fetch_batch_messages,
    task_has_channels,
)
from server.scheduler.result_store import store_results
from server.scheduler.task_schedule_overrides import (
    resolve_batch_message_limit,
    resolve_trigger_threshold,
)
from server.scheduler.under_threshold_skip import note_under_threshold_skip
from server.sse import Broadcaster, publish_resource_modified
from server.util import utc_now_iso

if TYPE_CHECKING:
    from server.scheduler.manager import SchedulerManager

logger = logging.getLogger(__name__)


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
            source="server.scheduler.agent_tick",
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


async def run_schedule_or_threshold(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task: dict[str, Any],
    task_id: str,
    spec: AgentTaskSpec,
    scheduler: SchedulerManager | None,
) -> None:
    prompt_template = str(task.get("prompt_template") or "").strip()
    task_name = str(task.get("name") or "")
    version = int(task.get("version") or 1)

    if not prompt_template:
        await record_agent_skip(
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

    if spec.trigger_mode == TRIGGER_MESSAGE_THRESHOLD and has_channels:
        claimed = await _claim_messages_for_gate(db, task)
        if claimed is None:
            return
        batch_id, claimed_messages = claimed
    else:
        batch_id = await open_processing_batch(db, task=task, message_count=0)

    llm_cfg = await load_llm_config(db)
    search_on = spec.cap_force_web_search or spec.cap_web_search
    route = resolve_web_search_route(
        web_search_enabled=search_on,
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
            "analysisMode": AGENT_MODE,
        },
    )

    llm_timeout = await get_config_int(db, "llm_generation_timeout")
    ui_locale = await get_config(db, "ui_locale")
    source_text = format_messages(claimed_messages) if claimed_messages else None
    seed = build_agent_seed_message(
        task_name=task_name,
        task_id=task_id,
        spec=spec,
        source_messages_text=source_text,
    )
    pinned = build_agent_base_prompt(prompt_template, spec)
    policy = channel_from_agent_spec(spec, stateless=True)

    max_rounds = await get_config_int(db, "agent_max_tool_rounds")
    if max_rounds <= 0:
        max_rounds = DEFAULT_AGENT_MAX_TOOL_ROUNDS

    client: ConfigurableLlmClient | None = None
    items: list[dict[str, Any]] = []
    used_mode = route.mode
    final_text = ""
    tool_calls: list[Any] = []
    try:
        client = await ConfigurableLlmClient.from_db_for_agent(db)
        runtime = AgentRuntime(
            db,
            client,
            max_tool_rounds=max_rounds,
            broadcaster=broadcaster,
        )
        result = await asyncio.wait_for(
            runtime.chat(
                [{"role": "user", "content": seed}],
                locale=ui_locale,
                channel="agent",
                policy=policy,
                agent_scope_task_id=task_id if spec.output_calendar else None,
                base_prompt=pinned,
            ),
            timeout=max(int(llm_timeout) * 2, 1),
        )
        raw_message = result.get("message")
        final_text = raw_message if isinstance(raw_message, str) else ""
        tool_calls = result.get("toolCalls") or []
        if not isinstance(tool_calls, list):
            tool_calls = []
        if spec.output_analysis_events:
            items = parse_agent_items(final_text)
        if isinstance(tool_calls, list) and any(
            isinstance(call, dict) and str(call.get("name") or "").startswith("web.") for call in tool_calls
        ):
            used_mode = f"agent:{route.mode}"
        else:
            used_mode = f"agent:{route.mode}:no_web_tool"
    except Exception as exc:  # noqa: BLE001
        logger.exception("agent tick failed task=%s batch=%s", task_id, batch_id)
        await complete_agent_failure(
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

    if spec.output_analysis_events:
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
                logger.warning("Geocoding skipped for agent batch %s: %s", batch_id, exc)

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
        broadcaster.publish(
            "analysis_completed",
            {
                "taskId": task_id,
                "batchId": batch_id,
                "analysisMode": AGENT_MODE,
                "findingsCount": findings_count,
                "hasFindings": findings_count > 0,
                "webSearchMode": used_mode,
                "messageCount": len(claimed_messages),
            },
        )
    else:
        done = utc_now_iso()
        message = truncate_text(final_text, _AGENT_MESSAGE_LIMIT) if final_text else "agent tick completed"
        await db.execute(
            "UPDATE analysis_batches SET status = 'completed', prompt_tokens = ?, "
            "completion_tokens = ?, error_message = NULL, message_count = ?, "
            "agent_message = ?, tool_calls_json = ?, updated_at = ?, completed_at = ? WHERE id = ?",
            (
                0,
                0,
                len(claimed_messages),
                message,
                serialize_tick_tool_calls(tool_calls),
                done,
                done,
                batch_id,
            ),
        )
        broadcaster.publish(
            "analysis_completed",
            {
                "taskId": task_id,
                "batchId": batch_id,
                "analysisMode": AGENT_MODE,
                "findingsCount": 0,
                "hasFindings": False,
                "webSearchMode": used_mode,
                "messageCount": len(claimed_messages),
            },
        )

    publish_resource_modified(
        broadcaster,
        resource_type="task",
        resource_id=task_id,
        action="updated",
    )


__all__ = ["run_schedule_or_threshold"]
