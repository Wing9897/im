"""``message_cursor`` trigger path for agent ticks (multi-wave drain)."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from server.agent.channels import channel_from_agent_spec
from server.agent.runtime import AgentRuntime
from server.agent.web_search_routing import resolve_web_search_route
from server.analyzer.llm_client import ConfigurableLlmClient
from server.app_logging import failure_details_from_exc
from server.config import get_config_int
from server.db.database import Database
from server.domain.agent_task_spec import AgentTaskSpec
from server.domain.analysis_modes import AGENT_MODE
from server.queries.agent_tick_queries import (
    complete_agent_batch,
    ensure_agent_batch,
    fetch_agent_messages_since,
    load_agent_message_cursor,
)
from server.scheduler.agent_batches import complete_agent_failure
from server.scheduler.agent_tick_format import (
    _AGENT_MESSAGE_LIMIT,
    _SKIP_NO_MESSAGES,
    DEFAULT_AGENT_MAX_DRAIN_WAVES,
    DEFAULT_AGENT_MAX_TOOL_ROUNDS_CURSOR,
    MESSAGE_SUMMARY_LIMIT,
    serialize_tick_tool_calls,
    truncate_text,
)
from server.scheduler.task_schedule_overrides import resolve_agent_wave_interval_seconds
from server.sse import Broadcaster, publish_resource_modified

if TYPE_CHECKING:
    from server.scheduler.manager import SchedulerManager

logger = logging.getLogger(__name__)


async def _complete_cursor_batch(
    db: Database,
    batch_id: str,
    *,
    agent_message: str | None = None,
    tool_calls: Any = None,
    message_count: int | None = None,
) -> None:
    message = None
    if isinstance(agent_message, str) and agent_message.strip():
        message = truncate_text(agent_message, _AGENT_MESSAGE_LIMIT)
    await complete_agent_batch(
        db,
        batch_id,
        agent_message=message,
        tool_calls_json=serialize_tick_tool_calls(tool_calls),
        message_count=message_count,
    )


def _cursor_web_search_mode(tool_calls: Any, route_mode: str) -> str:
    if isinstance(tool_calls, list) and any(
        isinstance(call, dict) and str(call.get("name") or "").startswith("web.") for call in tool_calls
    ):
        return f"agent:{route_mode}"
    return f"agent:{route_mode}:no_web_tool"


async def run_cursor_drain(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task: dict[str, Any],
    task_id: str,
    spec: AgentTaskSpec,
    scheduler: SchedulerManager | None = None,
) -> None:
    from server.analyzer.llm_config import load_llm_config_for_task
    from server.scheduler.agent_tick_drain import drain_agent_waves

    task_name = str(task.get("name") or "")
    version = int(task.get("version") or 1)

    cursor = await load_agent_message_cursor(db, task_id)
    messages = await fetch_agent_messages_since(
        db,
        task_id=task_id,
        since=cursor,
        limit=MESSAGE_SUMMARY_LIMIT,
    )
    if not messages:
        batch_id = await ensure_agent_batch(db, task, message_count=0)
        await _complete_cursor_batch(
            db,
            batch_id,
            agent_message=_SKIP_NO_MESSAGES,
            tool_calls=[],
            message_count=0,
        )
        broadcaster.publish(
            "analysis_completed",
            {
                "taskId": task_id,
                "batchId": batch_id,
                "analysisMode": AGENT_MODE,
                "findingsCount": 0,
                "hasFindings": False,
                "skipped": True,
                "skipReason": _SKIP_NO_MESSAGES,
            },
        )
        logger.info("Agent tick %s skipped: no new messages", task_id)
        return

    batch_id = await ensure_agent_batch(db, task, message_count=len(messages))
    max_rounds = await get_config_int(db, "agent_max_tool_rounds")
    if max_rounds <= 0:
        max_rounds = DEFAULT_AGENT_MAX_TOOL_ROUNDS_CURSOR
    max_waves = await get_config_int(db, "agent_max_drain_waves")
    if max_waves < 0:
        max_waves = DEFAULT_AGENT_MAX_DRAIN_WAVES
    wave_interval = resolve_agent_wave_interval_seconds(task)

    llm: ConfigurableLlmClient | None = None
    total_messages = 0
    policy = channel_from_agent_spec(spec, stateless=False)
    try:
        llm_cfg = await load_llm_config_for_task(db, task)
        search_on = spec.cap_force_web_search or spec.cap_web_search
        route = resolve_web_search_route(
            web_search_enabled=search_on,
            web_search_provider=llm_cfg["web_search_provider"],
            llm_provider=llm_cfg["provider"],
            llm_base_url=llm_cfg["base_url"],
        )
        broadcaster.publish(
            "analysis_started",
            {
                "taskId": task_id,
                "taskName": task_name,
                "batchId": batch_id,
                "messageCount": len(messages),
                "estimatedTokens": 0,
                "llmProvider": llm_cfg["provider"],
                "llmModel": llm_cfg["model"],
                "webSearchMode": route.mode,
                "analysisMode": AGENT_MODE,
            },
        )
        llm = await ConfigurableLlmClient.from_profile(db, str(task.get("llm_profile_id") or "") or None)
        runtime = AgentRuntime(
            db,
            llm,
            max_tool_rounds=max_rounds,
            broadcaster=broadcaster,
        )
        drain = await drain_agent_waves(
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
        broadcaster.publish(
            "analysis_completed",
            {
                "taskId": task_id,
                "batchId": batch_id,
                "analysisMode": AGENT_MODE,
                "findingsCount": 0,
                "hasFindings": False,
                "webSearchMode": _cursor_web_search_mode(drain.all_tool_calls, route.mode),
                "messageCount": total_messages,
            },
        )
        publish_resource_modified(
            broadcaster,
            resource_type="task",
            resource_id=task_id,
            action="updated",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Agent cursor tick failed for task %s", task_id)
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
    finally:
        if llm is not None:
            await llm.close()


__all__ = ["run_cursor_drain"]
