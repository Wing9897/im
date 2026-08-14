"""Single source of truth for ``analysis_tasks.analysis_time_range`` vocabulary.

DDL CHECK in ``server/db/schema_domains/tasks.py`` embeds
``ANALYSIS_TIME_RANGE_CHECK_SQL``. Offset keys (everything except ``all`` /
``today``) must stay resolvable by ``server.analyzer.incremental``
(guarded in ``test_db_schema.py``); the FE mirrors this list in
``TASK_ANALYSIS_TIME_RANGE_VALUES`` (guarded in ``test_backend_consolidation.py``).
"""

from __future__ import annotations

from typing import Final, Literal

AnalysisTimeRange = Literal["all", "today", "1h", "6h", "48h", "1d", "7d", "30d"]

ALL_ANALYSIS_TIME_RANGES: Final[tuple[AnalysisTimeRange, ...]] = (
    "all",
    "today",
    "1h",
    "6h",
    "48h",
    "1d",
    "7d",
    "30d",
)

ALLOWED_ANALYSIS_TIME_RANGES: Final[frozenset[str]] = frozenset(ALL_ANALYSIS_TIME_RANGES)

ANALYSIS_TIME_RANGE_CHECK_SQL = "CHECK (analysis_time_range IN ({}))".format(
    ",".join(f"'{value}'" for value in ALL_ANALYSIS_TIME_RANGES)
)
