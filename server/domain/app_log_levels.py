"""Single source of truth for ``app_logs.level`` vocabulary.

DDL CHECK in ``server/db/schema_domains/system.py`` embeds
``APP_LOG_LEVEL_CHECK_SQL``; ``server.app_logging.normalize_log_level`` is the
sole write-path gate.
"""

from __future__ import annotations

from typing import Final, Literal

AppLogLevel = Literal["info", "success", "warning", "error"]

ALL_APP_LOG_LEVELS: Final[tuple[AppLogLevel, ...]] = (
    "info",
    "success",
    "warning",
    "error",
)

ALLOWED_APP_LOG_LEVELS: Final[frozenset[str]] = frozenset(ALL_APP_LOG_LEVELS)

APP_LOG_LEVEL_CHECK_SQL = "CHECK (level IN ({}))".format(",".join(f"'{value}'" for value in ALL_APP_LOG_LEVELS))
