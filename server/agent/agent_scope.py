"""Agent calendar-scope tool policy (message_cursor / output_calendar presets).

When ``AgentRuntime`` runs with a scoped task id, the runtime injects
``agent_scope_task_id`` into the tool-dispatch context. This module mutates
tool arguments so calendar／messages tools stay inside that task.

Calendar-writing agent ticks set ``user_events.origin`` from
``AgentTaskSpec.user_event_origin()`` (``agent`` for calendar-writing presets).
``origin=agent`` is provenance only — not the retired ``analysis_mode=project``.
"""

from __future__ import annotations

from typing import Any

from server.db.database import Database
from server.queries.tasks_queries import fetch_task_channel_rows
from server.wire.serializers import channel_key

AGENT_SCOPE_READ_TOOLS = frozenset(
    {
        "calendar.list_calendars",
        "calendar.upcoming",
        "calendar.recent",
        "calendar.window",
        "calendar.get",
    }
)
AGENT_SCOPE_EVENT_WRITE_TOOLS = frozenset(
    {
        "calendar.create_event",
        "calendar.update_event",
        "calendar.delete_event",
    }
)


async def apply_agent_scope(
    db: Database,
    name: str,
    args: dict[str, Any],
    *,
    scope_task_id: str,
) -> dict[str, Any] | None:
    """Mutate ``args`` for agent ticks. Return an error dict to short-circuit."""
    if name in AGENT_SCOPE_READ_TOOLS or name in AGENT_SCOPE_EVENT_WRITE_TOOLS:
        # Force calendar reads/writes onto this task (and its child recurrings).
        args["taskId"] = scope_task_id
        args.pop("task_id", None)
        args["_default_task_id"] = scope_task_id
        args["_agent_scope_task_id"] = scope_task_id

    if name == "calendar.create_event":
        args["taskId"] = scope_task_id
        args["_default_task_id"] = scope_task_id

    if name == "calendar.create_recurring_task":
        args["_parent_task_id"] = scope_task_id

    if name in {"calendar.update_recurring_task", "calendar.delete_recurring_task"}:
        args["_require_parent_task_id"] = scope_task_id

    if name == "messages.search":
        rows = await fetch_task_channel_rows(db, scope_task_id)
        if not rows:
            return {
                "error": "agent task has no bound channels; messages.search unavailable",
                "items": [],
                "count": 0,
            }
        # Restrict to task_channels even if the model passed other channelIds.
        args["channelIds"] = [channel_key(str(r["platform"]), str(r["platform_id"])) for r in rows]
        args.pop("channel_ids", None)

    return None
