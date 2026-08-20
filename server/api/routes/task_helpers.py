"""HTTP assembly for task routes: 422 mapping stays in the route modules.

HTTP-agnostic policy lives in ``services.task_policy``.
Recurring-only recurrence expanded at query time; never an AI analysis trigger.
"""

from __future__ import annotations

from typing import Any

from server.api.schemas.requests import TaskConfigBody
from server.errors import VALIDATION_ERROR, http_error
from server.queries.llm_profiles_queries import fetch_profile_row
from server.queries.tasks_queries import fetch_task_channel_rows
from server.wire.serializers import serialize_channel_ref, serialize_task

__all__ = [
    "TaskConfigBody",
    "channel_refs_for",
    "resolve_llm_profile_id",
    "task_response",
]


async def resolve_llm_profile_id(
    db: Any,
    *,
    supplied: str | None,
    existing: str | None = None,
    fields_set: set[str] | None = None,
    require_complete: bool = True,
) -> str:
    """Resolve required llm_profile_id; fall back to oldest profile when omitted.

    Never invents a fake ``__default__`` id. When no profiles exist (or the
    chosen profile is incomplete), raises 400 with a clear message.
    """
    from server.analyzer.llm_config import fetch_first_profile_id, require_complete_profile_row

    explicit = fields_set is None or "llmProfileId" in fields_set
    profile_id: str | None = None
    if explicit and supplied is not None and str(supplied).strip():
        profile_id = str(supplied).strip()
        if await fetch_profile_row(db, profile_id) is None:
            raise http_error(400, f"Unknown llmProfileId: {profile_id}", error_code=VALIDATION_ERROR)
    elif existing and str(existing).strip():
        profile_id = str(existing).strip()
    else:
        profile_id = await fetch_first_profile_id(db)

    if require_complete:
        await require_complete_profile_row(db, profile_id)
    return profile_id


async def channel_refs_for(db: Any, task_id: str) -> list[dict[str, Any]]:
    rows = await fetch_task_channel_rows(db, task_id)
    return [serialize_channel_ref(row) for row in rows]


def task_response(
    row: dict[str, Any],
    channel_refs: list[dict[str, Any]] | None,
    *,
    deleted: int = 0,
) -> dict:
    result = serialize_task(row, channel_refs)
    result.update({"deletedBatchCount": deleted})
    return result
