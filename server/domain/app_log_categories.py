"""Single source of truth for ``app_logs.category`` vocabulary.

Unlike ``level`` this column carries **no** DDL CHECK — the write gate is
``server.app_logging.normalize_log_category`` (unknown → ``system``), so the
wire Literal in ``AppLogEntryResponse`` can never see an out-of-set value.
``frontend`` is reserved for browser-originated rows posted to
``POST /api/v1/logs``.
"""

from __future__ import annotations

from typing import Final, Literal

AppLogCategory = Literal["analysis", "collector", "source", "system", "frontend"]

ALL_APP_LOG_CATEGORIES: Final[tuple[AppLogCategory, ...]] = (
    "analysis",
    "collector",
    "source",
    "system",
    "frontend",
)

ALLOWED_APP_LOG_CATEGORIES: Final[frozenset[str]] = frozenset(ALL_APP_LOG_CATEGORIES)
