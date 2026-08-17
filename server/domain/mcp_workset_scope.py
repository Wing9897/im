"""MCP/A2A workset visibility helpers.

Allowed ids are worksets with ``external_enabled=1`` (see
``fetch_external_enabled_workset_ids``). Empty set = fail closed.
Calendar 我的日程 and in-app assistant are not gated here.
"""

from __future__ import annotations

from typing import Any, Final

#: Injected into tool args (handlers / queries).
ALLOWED_WORKSET_IDS_ARG: Final = "_allowed_workset_ids"

WORKSET_NOT_ALLOWED_ERROR: Final = "workset not allowed"


def bind_workset_ids_sql(column: str, workset_ids: list[str] | None) -> tuple[str | None, list[str]]:
    """``None`` → no clause. Empty list → ``1=0``. Else ``column IN (...)``."""
    if workset_ids is None:
        return None, []
    if not workset_ids:
        return "1=0", []
    placeholders = ", ".join("?" for _ in workset_ids)
    return f"{column} IN ({placeholders})", list(workset_ids)


def allowed_workset_ids_from_args(arguments: dict[str, Any]) -> list[str] | None:
    if ALLOWED_WORKSET_IDS_ARG not in arguments:
        return None
    raw = arguments.get(ALLOWED_WORKSET_IDS_ARG)
    if not isinstance(raw, list):
        return []
    return [str(item).strip() for item in raw if isinstance(item, str) and str(item).strip()]
