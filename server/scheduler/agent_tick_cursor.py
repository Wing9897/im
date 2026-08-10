"""``message_cursor`` trigger path for agent ticks (multi-wave drain)."""

from __future__ import annotations

import logging
from typing import Any

from server.agent.channels import channel_from_agent_spec
from server.agent.runtime import AgentRuntime
from server.analyzer.llm_client import ConfigurableLlmClient
from server.config import get_config_int
from server.db.database import Database
from server.domain.agent_task_spec import AgentTaskSpec
from server.queries.agent_tick_queries import (
    complete_agent_batch,
    ensure_agent_batch,
    fetch_agent_messages_since,
    load_agent_message_cursor,
)
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

logger = logging.getLogger(__name__)


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
        await complete_agent_batch(
            db,
            batch_id,
            error_message=error_message,
            message_count=message_count,
        )
        return
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


async def run_cursor_drain(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task: dict[str, Any],
    task_id: str,
    spec: AgentTaskSpec,
) -> None:
    from server.scheduler.agent_tick_drain import drain_agent_waves

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
        llm = await ConfigurableLlmClient.from_db_for_agent(db)
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


__all__ = ["run_cursor_drain"]
