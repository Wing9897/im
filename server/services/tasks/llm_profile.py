"""Resolve the LLM profile a task write will store."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from server.analyzer.llm_config import fetch_first_profile_id, require_complete_profile_row
from server.errors import diagnostic_error_fields
from server.queries.llm_profiles_queries import fetch_profile_row
from server.services.task_writes import TaskWriteError


def _profile_write_error(exc: HTTPException) -> TaskWriteError:
    _code, message = diagnostic_error_fields(exc)
    return TaskWriteError(message, http_status=exc.status_code)


async def ensure_complete_llm_profile(db: Any, profile_id: str | None) -> None:
    """Reject a missing or incomplete profile as ``TaskWriteError``."""
    try:
        await require_complete_profile_row(db, profile_id or "")
    except HTTPException as exc:
        raise _profile_write_error(exc) from exc


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
    chosen profile is incomplete), raises ``TaskWriteError`` (routes map the
    historical 400 / 404).
    """
    explicit = fields_set is None or "llmProfileId" in fields_set
    profile_id: str | None = None
    if explicit and supplied is not None and str(supplied).strip():
        profile_id = str(supplied).strip()
        if await fetch_profile_row(db, profile_id) is None:
            raise TaskWriteError(f"Unknown llmProfileId: {profile_id}", http_status=400)
    elif existing and str(existing).strip():
        profile_id = str(existing).strip()
    else:
        try:
            profile_id = await fetch_first_profile_id(db)
        except HTTPException as exc:
            raise _profile_write_error(exc) from exc

    if require_complete:
        await ensure_complete_llm_profile(db, profile_id)
    return profile_id
