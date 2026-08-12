"""Stable aggregation point for the wipe-only SQLite baseline."""

from server.db.schema_domains import (
    actions,
    analysis,
    auth,
    calendar,
    items,
    llm,
    sources,
    system,
    tasks,
    ui,
)

DDL_PARTS = (
    sources.DDL,
    llm.DDL,  # profiles before analysis_tasks.llm_profile_id FK
    tasks.DDL,
    analysis.DDL,
    system.DDL,
    actions.DDL,
    items.DDL,  # before calendar: user_events / recurring_schedules item_id FK
    calendar.DDL,
    auth.DDL,
    ui.DDL,
)
DDL = "\n\n".join(DDL_PARTS)

__all__ = ["DDL", "DDL_PARTS"]
