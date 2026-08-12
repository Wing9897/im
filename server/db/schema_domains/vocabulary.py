"""Shared CHECK-clause vocabulary for schema fragments."""

from server.domain.analysis_modes import ALL_ANALYSIS_MODES
from server.domain.collector_platforms import COLLECTOR_PLATFORMS
from server.domain.timeline_sources import TIMELINE_SOURCE_CHECK_SQL
from server.domain.user_event_origins import USER_EVENT_ORIGIN_CHECK_SQL

PLATFORM_CHECK_VALUES = COLLECTOR_PLATFORMS
PLATFORM_CHECK_SQL = "CHECK (platform IN ({}))".format(",".join(f"'{value}'" for value in PLATFORM_CHECK_VALUES))

ANALYSIS_MODE_CHECK_VALUES = ALL_ANALYSIS_MODES
ANALYSIS_MODE_CHECK_SQL = "CHECK (analysis_mode IN ({}))".format(
    ",".join(f"'{value}'" for value in ANALYSIS_MODE_CHECK_VALUES)
)

ANALYSIS_TIME_RANGE_VALUES = (
    "all",
    "today",
    "1h",
    "6h",
    "48h",
    "1d",
    "7d",
    "30d",
)
ANALYSIS_TIME_RANGE_CHECK_SQL = "CHECK (analysis_time_range IN ({}))".format(
    ",".join(f"'{value}'" for value in ANALYSIS_TIME_RANGE_VALUES)
)

APP_LOG_LEVEL_VALUES = ("info", "success", "warning", "error")
APP_LOG_LEVEL_CHECK_SQL = "CHECK (level IN ({}))".format(",".join(f"'{value}'" for value in APP_LOG_LEVEL_VALUES))

__all__ = [
    "PLATFORM_CHECK_VALUES",
    "PLATFORM_CHECK_SQL",
    "ANALYSIS_MODE_CHECK_VALUES",
    "ANALYSIS_MODE_CHECK_SQL",
    "ANALYSIS_TIME_RANGE_VALUES",
    "ANALYSIS_TIME_RANGE_CHECK_SQL",
    "APP_LOG_LEVEL_VALUES",
    "APP_LOG_LEVEL_CHECK_SQL",
    "USER_EVENT_ORIGIN_CHECK_SQL",
    "TIMELINE_SOURCE_CHECK_SQL",
]
