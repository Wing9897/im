"""Unified scheduled tick for ``analysis_mode=agent``.

Trigger modes:
- ``message_cursor`` — skip LLM when no new messages; multi-wave drain
- ``message_threshold`` — channel-bound threshold gate (else quiet skip)
- ``schedule`` — pure timed fire

Policy (tools / outputs / origin) comes from ``AgentTaskSpec`` on the task row.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import TYPE_CHECKING, Any

from server.agent.channels import channel_from_agent_spec
from server.agent.runtime import AgentRuntime
from server.agent.web_search_routing import resolve_web_search_route
from server.analyzer.incremental import fetch_unanalyzed_messages
from server.analyzer.llm_client import ConfigurableLlmClient, load_llm_config
from server.analyzer.llm_json import normalize_items, parse_json_response
from server.analyzer.prompt import format_messages
from server.app_logging import failure_details_from_exc
from server.config import get_config, get_config_bool, get_config_int
from server.db.database import Database
from server.domain.agent_task_spec import (
    TRIGGER_MESSAGE_CURSOR,
    TRIGGER_MESSAGE_THRESHOLD,
    AgentTaskSpec,
    AgentTaskSpecError,
    agent_task_spec_from_row,
)
from server.domain.analysis_modes import AGENT_MODE
from server.prompts.agent_task import build_agent_base_prompt, build_agent_seed_message
from server.queries.project_tick_queries import (
    ProjectMessageCursor,
    complete_project_batch,
    ensure_project_batch,
    fetch_project_messages_since,
    load_project_message_cursor,
)
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
    resolve_project_wave_interval_seconds,
    resolve_trigger_threshold,
)
from server.scheduler.under_threshold_skip import note_under_threshold_skip
from server.scheduler.web_intel_batches import (
    complete_web_intel_failure,
    open_processing_batch,
    record_web_intel_skip,
)
from server.sse import Broadcaster, publish_resource_modified
from server.util import utc_now_iso

if TYPE_CHECKING:
    from server.scheduler.manager import SchedulerManager

logger = logging.getLogger(__name__)

DEFAULT_AGENT_MAX_TOOL_ROUNDS_CURSOR = 28
DEFAULT_AGENT_MAX_TOOL_ROUNDS = 8
DEFAULT_AGENT_MAX_DRAIN_WAVES = 0
MESSAGE_SUMMARY_LIMIT = 40
_MESSAGE_SUMMARY_LIMIT = MESSAGE_SUMMARY_LIMIT
_AGENT_MESSAGE_LIMIT = 2000
_TOOL_CALLS_MAX = 40
_TOOL_ARGS_JSON_LIMIT = 400
_TOOL_RESULT_SUMMARY_LIMIT = 500
_SKIP_NO_MESSAGES = "skipped: no new messages"
_SKIP_EMPTY_PROMPT = "skipped: empty prompt_template"


def _truncate_text(value: str, limit: int) -> str:
    text = value.strip()
    if len(text) <= limit:
        return text
    if limit <= 1:
        return text[:limit]
    return text[: limit - 1] + "…"


def serialize_tick_tool_calls(tool_calls: Any) -> str:
    """Compact JSON array for ``analysis_batches.tool_calls_json``."""
    if not isinstance(tool_calls, list):
        return "[]"
    entries: list[dict[str, Any]] = []
    for item in tool_calls:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        if not isinstance(name, str) or not name.strip():
            continue
        entry: dict[str, Any] = {"name": name.strip()}
        arguments = item.get("arguments")
        if isinstance(arguments, dict):
            raw_args = json.dumps(arguments, ensure_ascii=False, sort_keys=True)
            if len(raw_args) > _TOOL_ARGS_JSON_LIMIT:
                entry["arguments"] = {"_truncated": _truncate_text(raw_args, _TOOL_ARGS_JSON_LIMIT)}
            else:
                entry["arguments"] = arguments
        summary = item.get("resultSummary")
        if isinstance(summary, str) and summary.strip():
            entry["resultSummary"] = _truncate_text(summary, _TOOL_RESULT_SUMMARY_LIMIT)
        entries.append(entry)
        if len(entries) >= _TOOL_CALLS_MAX:
            break
    return json.dumps(entries, ensure_ascii=False)


def parse_agent_items(final_message: str) -> list[dict[str, Any]]:
    """Parse Agent final text into analysis-event item dicts."""
    text = (final_message or "").strip()
    if not text:
        return []
    parsed = parse_json_response(text)
    if isinstance(parsed, dict) and "items" not in parsed:
        nested = parsed.get("message")
        if isinstance(nested, str) and nested.strip():
            try:
                parsed = parse_json_response(nested)
            except ValueError:
                pass
    return [item for item in normalize_items(parsed) if isinstance(item, dict)]


async def _complete_cursor_batch(
    db: Database,
    batch_id: str,
    *,
    error_message: str | None = None,
    agent_message: str | None = None,
    tool_calls: Any = None,
    message_count: int | None = None,
) -> None:
    if error_message:
        await complete_project_batch(
            db,
            batch_id,
            error_message=error_message,
            message_count=message_count,
        )
        return
    message = None
    if isinstance(agent_message, str) and agent_message.strip():
        message = _truncate_text(agent_message, _AGENT_MESSAGE_LIMIT)
    await complete_project_batch(
        db,
        batch_id,
        agent_message=message,
        tool_calls_json=serialize_tick_tool_calls(tool_calls),
        message_count=message_count,
    )


def build_project_seed_message(
    *,
    task: dict[str, Any],
    calendar_summary: str,
    message_lines: list[str],
    cursor: ProjectMessageCursor | str | None,
    wave_index: int = 1,
    wave_total_hint: str | None = None,
) -> str:
    """User-turn seed for one drain wave (compat helper for tests)."""
    if isinstance(cursor, ProjectMessageCursor):
        cursor_label = cursor.timestamp
    else:
        cursor_label = cursor
    try:
        spec = agent_task_spec_from_row(task, has_channels=True)
    except AgentTaskSpecError:
        from server.domain.agent_task_spec import agent_preset_spec

        spec = agent_preset_spec("project_reconcile", has_channels=True)
    return build_agent_seed_message(
        task_name=str(task.get("name") or task.get("id") or "agent"),
        task_id=str(task["id"]),
        spec=spec,
        calendar_summary=calendar_summary,
        message_lines=message_lines,
        cursor_label=cursor_label,
        wave_index=wave_index,
        wave_total_hint=wave_total_hint,
    )


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


async def _run_cursor_drain(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task: dict[str, Any],
    task_id: str,
    spec: AgentTaskSpec,
) -> None:
    from server.scheduler.project_tick_drain import drain_project_waves

    cursor = await load_project_message_cursor(db, task_id)
    messages = await fetch_project_messages_since(
        db,
        task_id=task_id,
        since=cursor,
        limit=MESSAGE_SUMMARY_LIMIT,
    )
    if not messages:
        batch_id = await ensure_project_batch(db, task, message_count=0)
        await _complete_cursor_batch(
            db,
            batch_id,
            agent_message=_SKIP_NO_MESSAGES,
            tool_calls=[],
            message_count=0,
        )
        logger.info("Agent tick %s skipped: no new messages", task_id)
        return

    batch_id = await ensure_project_batch(db, task, message_count=len(messages))
    max_rounds = await get_config_int(db, "agent_project_max_tool_rounds")
    if max_rounds <= 0:
        max_rounds = DEFAULT_AGENT_MAX_TOOL_ROUNDS_CURSOR
    max_waves = await get_config_int(db, "agent_project_max_drain_waves")
    if max_waves < 0:
        max_waves = DEFAULT_AGENT_MAX_DRAIN_WAVES
    wave_interval = resolve_project_wave_interval_seconds(task)

    llm: ConfigurableLlmClient | None = None
    total_messages = 0
    policy = channel_from_agent_spec(spec, stateless=False)
    try:
        llm = await ConfigurableLlmClient.from_db_for_agent(db)
        runtime = AgentRuntime(
            db,
            llm,
            max_tool_rounds=max_rounds,
            broadcaster=broadcaster,
        )
        drain = await drain_project_waves(
            db=db,
            runtime=runtime,
            task=task,
            task_id=task_id,
            batch_id=batch_id,
            messages=messages,
            cursor=cursor,
            max_waves=max_waves,
            wave_interval=wave_interval,
            spec=spec,
            policy=policy,
        )
        total_messages = drain.total_messages
        combined = "\n".join(drain.wave_summaries) if drain.wave_summaries else "agent tick completed"
        await _complete_cursor_batch(
            db,
            batch_id,
            agent_message=combined,
            tool_calls=drain.all_tool_calls,
            message_count=total_messages,
        )
        if broadcaster is not None:
            publish_resource_modified(
                broadcaster,
                resource_type="task",
                resource_id=task_id,
                action="updated",
            )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Agent cursor tick failed for task %s", task_id)
        await _complete_cursor_batch(
            db,
            batch_id,
            error_message=str(exc),
            message_count=total_messages or None,
        )
    finally:
        if llm is not None:
            await llm.close()


async def _run_schedule_or_threshold(
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
            max_tool_rounds=DEFAULT_AGENT_MAX_TOOL_ROUNDS,
            broadcaster=broadcaster,
        )
        result = await asyncio.wait_for(
            runtime.chat(
                [{"role": "user", "content": seed}],
                locale=ui_locale,
                channel="agent",
                policy=policy,
                project_scope_task_id=task_id if spec.output_calendar else None,
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
        message = _truncate_text(final_text, _AGENT_MESSAGE_LIMIT) if final_text else "agent tick completed"
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
        await _run_cursor_drain(
            db=db,
            broadcaster=broadcaster,
            task=task,
            task_id=task_id,
            spec=spec,
        )
        return

    await _run_schedule_or_threshold(
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
    "build_project_seed_message",
    "execute_agent_tick",
    "parse_agent_items",
    "serialize_tick_tool_calls",
]
