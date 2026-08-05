"""Stable aggregation point for the wipe-only SQLite baseline."""

from server.db.schema_domains import (
    actions,
    analysis,
    auth,
    calendar,
    items,
    sources,
    system,
    tasks,
    ui,
)

DDL_PARTS = (
    sources.DDL,
    tasks.DDL,
    analysis.DDL,
    system.DDL,
    actions.DDL,
    calendar.DDL,
    items.DDL,
    auth.DDL,
    ui.DDL,
)
DDL = "\n\n".join(DDL_PARTS)

__all__ = ["DDL", "DDL_PARTS"]
