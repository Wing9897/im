"""Re-export hub for the CHECK clauses that schema fragments embed.

Every clause is generated in its ``server/domain`` module; nothing is assembled
here. Schema fragments import from this module so the DDL files stay free of
domain-layer import paths.
"""

from server.domain.analysis_modes import ANALYSIS_MODE_CHECK_SQL
from server.domain.analysis_time_ranges import ANALYSIS_TIME_RANGE_CHECK_SQL
from server.domain.app_log_levels import APP_LOG_LEVEL_CHECK_SQL
from server.domain.collector_platforms import PLATFORM_CHECK_SQL
from server.domain.llm_providers import LLM_PROVIDER_CHECK_SQL
from server.domain.llm_staff_classes import LLM_STAFF_CLASS_CHECK_SQL
from server.domain.timeline_sources import TIMELINE_SOURCE_CHECK_SQL
from server.domain.user_event_directions import USER_EVENT_DIRECTION_CHECK_SQL
from server.domain.user_event_kinds import USER_EVENT_KIND_CHECK_SQL
from server.domain.user_event_origins import USER_EVENT_ORIGIN_CHECK_SQL

__all__ = [
    "PLATFORM_CHECK_SQL",
    "ANALYSIS_MODE_CHECK_SQL",
    "ANALYSIS_TIME_RANGE_CHECK_SQL",
    "APP_LOG_LEVEL_CHECK_SQL",
    "USER_EVENT_ORIGIN_CHECK_SQL",
    "USER_EVENT_KIND_CHECK_SQL",
    "USER_EVENT_DIRECTION_CHECK_SQL",
    "TIMELINE_SOURCE_CHECK_SQL",
    "LLM_PROVIDER_CHECK_SQL",
    "LLM_STAFF_CLASS_CHECK_SQL",
]
