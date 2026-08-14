"""Single source of truth for ``analysis_strategy_mode`` vocabulary.

DDL CHECK in ``server/db/schema_domains/tasks.py`` embeds
``ANALYSIS_STRATEGY_MODE_CHECK_SQL`` (SQLite ``IN`` CHECK evaluates to NULL for
a NULL column value, so the nullable per-task override passes). Prompt copy per
mode lives in ``server.prompts.analysis.STRATEGY_INSTRUCTIONS`` (drift-tested).
"""

from __future__ import annotations

from typing import Final, Literal

STRATEGY_CONSERVATIVE: Final = "conservative"
STRATEGY_BALANCED: Final = "balanced"
STRATEGY_AGGRESSIVE: Final = "aggressive"

AnalysisStrategyMode = Literal["conservative", "balanced", "aggressive"]

ALL_ANALYSIS_STRATEGY_MODES: Final[tuple[AnalysisStrategyMode, ...]] = (
    STRATEGY_CONSERVATIVE,
    STRATEGY_BALANCED,
    STRATEGY_AGGRESSIVE,
)

ALLOWED_ANALYSIS_STRATEGY_MODES: Final[frozenset[str]] = frozenset(ALL_ANALYSIS_STRATEGY_MODES)

ANALYSIS_STRATEGY_MODE_CHECK_SQL = "CHECK (analysis_strategy_mode IN ({}))".format(
    ",".join(f"'{value}'" for value in ALL_ANALYSIS_STRATEGY_MODES)
)
