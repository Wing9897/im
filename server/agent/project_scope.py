"""Project-tick tool scope policy.

When ``AgentRuntime`` runs with ``channel=project``, the runtime injects
``project_scope_task_id`` into the tool-dispatch context. This module mutates
tool arguments so calendar／messages tools stay inside that project.

Project ticks write ``user_events.origin=project`` via
``PROJECT_CHANNEL.user_event_origin`` (see ``server/agent/channels.py``).
"""

from __future__ import annotations

from typing import Any

from server.db.database import Database
from server.queries.tasks_queries import fetch_task_channel_rows
from server.wire.serializers import channel_key

PROJECT_READ_TOOLS = frozenset(
    {
        "calendar.list_calendars",
        "calendar.upcoming",
        "calendar.recent",
        "calendar.window",
        "calendar.get",
    }
)
PROJECT_EVENT_WRITE_TOOLS = frozenset(
    {
        "calendar.create_event",
        "calendar.update_event",
        "calendar.delete_event",
    }
)


async def apply_project_scope(
    db: Database,
    name: str,
    args: dict[str, Any],
    *,
    project_id: str,
) -> dict[str, Any] | None:
    """Mutate ``args`` for project ticks. Return an error dict to short-circuit."""
    if name in PROJECT_READ_TOOLS or name in PROJECT_EVENT_WRITE_TOOLS:
        # Force calendar reads/writes onto this project (and its child recurrings).
        args["taskId"] = project_id
        args.pop("task_id", None)
        args["_default_task_id"] = project_id
        args["_project_scope_task_id"] = project_id

    if name == "calendar.create_event":
        args["taskId"] = project_id
        args["_default_task_id"] = project_id

    if name == "calendar.create_recurring_task":
        args["_parent_task_id"] = project_id

    if name in {"calendar.update_recurring_task", "calendar.delete_recurring_task"}:
        args["_require_parent_task_id"] = project_id

    if name == "messages.search":
        rows = await fetch_task_channel_rows(db, project_id)
        if not rows:
            return {
                "error": "project has no bound channels; messages.search unavailable",
                "items": [],
                "count": 0,
            }
        # Restrict to task_channels even if the model passed other channelIds.
        args["channelIds"] = [channel_key(str(r["platform"]), str(r["platform_id"])) for r in rows]
        args.pop("channel_ids", None)

    return None
