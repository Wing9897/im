"""Drift guards for vocabulary enums moved to ``server/domain`` (stamp 33).

Covers ``analysis_time_range``, app log ``level`` / ``category``, ``json_mode``,
``web_search_provider``, and the nullable ``analysis_strategy_mode``.
"""

from __future__ import annotations

import re

from server.db.schema_domains import llm as llm_ddl
from server.db.schema_domains import system as system_ddl
from server.db.schema_domains import tasks as tasks_ddl
from server.domain.analysis_strategy_modes import (
    ALL_ANALYSIS_STRATEGY_MODES,
    ALLOWED_ANALYSIS_STRATEGY_MODES,
    ANALYSIS_STRATEGY_MODE_CHECK_SQL,
)
from server.domain.analysis_time_ranges import (
    ALL_ANALYSIS_TIME_RANGES,
    ALLOWED_ANALYSIS_TIME_RANGES,
    ANALYSIS_TIME_RANGE_CHECK_SQL,
)
from server.domain.app_log_levels import (
    ALL_APP_LOG_LEVELS,
    ALLOWED_APP_LOG_LEVELS,
    APP_LOG_LEVEL_CHECK_SQL,
)
from server.domain.json_modes import ALL_JSON_MODES, ALLOWED_JSON_MODES, JSON_MODE_CHECK_SQL
from server.domain.web_search_providers import (
    ALL_WEB_SEARCH_PROVIDERS,
    ALLOWED_WEB_SEARCH_PROVIDERS,
    KEYED_WEB_SEARCH_PROVIDERS,
    WEB_SEARCH_PROVIDER_CHECK_SQL,
    WEB_SEARCH_SECRET_COLUMNS,
    WEB_SEARCH_SECRET_WIRE_FIELDS,
    WEB_SEARCH_SECRET_WIRE_NAMES,
)


def _check_values(ddl: str, pattern: str, label: str) -> frozenset[str]:
    match = re.search(pattern, ddl, re.IGNORECASE)
    assert match is not None, f"{label} CHECK not found in DDL"
    return frozenset(re.findall(r"'([^']+)'", match.group(1)))


def test_analysis_time_ranges_match_ddl_check() -> None:
    values = _check_values(
        tasks_ddl.DDL,
        r"analysis_time_range\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'all'\s+"
        r"CHECK\s+\(\s*analysis_time_range\s+IN\s+\(([^)]+)\)\s*\)",
        "analysis_tasks.analysis_time_range",
    )
    assert values == ALLOWED_ANALYSIS_TIME_RANGES
    assert ANALYSIS_TIME_RANGE_CHECK_SQL in tasks_ddl.DDL
    assert set(ALL_ANALYSIS_TIME_RANGES) == ALLOWED_ANALYSIS_TIME_RANGES


def test_app_log_levels_match_ddl_check_and_write_gate() -> None:
    from server.app_logging import normalize_log_level

    values = _check_values(
        system_ddl.DDL,
        r"level\s+TEXT\s+NOT\s+NULL\s+CHECK\s+\(\s*level\s+IN\s+\(([^)]+)\)\s*\)",
        "app_logs.level",
    )
    assert values == ALLOWED_APP_LOG_LEVELS
    assert APP_LOG_LEVEL_CHECK_SQL in system_ddl.DDL
    assert set(ALL_APP_LOG_LEVELS) == ALLOWED_APP_LOG_LEVELS
    for level in ALL_APP_LOG_LEVELS:
        assert normalize_log_level(level) == level
    assert normalize_log_level("debug") == "info"


def test_app_log_categories_match_write_gate_and_wire_literals() -> None:
    """``category`` has no DDL CHECK — the normalizer is the only gate."""
    from typing import get_args

    from server.api.schemas.responses.logs import AppLogEntryResponse
    from server.app_logging import ALLOWED_LOG_CATEGORIES, normalize_log_category
    from server.domain.app_log_categories import ALL_APP_LOG_CATEGORIES, ALLOWED_APP_LOG_CATEGORIES

    assert set(ALL_APP_LOG_CATEGORIES) == ALLOWED_APP_LOG_CATEGORIES
    assert ALLOWED_LOG_CATEGORIES == ALLOWED_APP_LOG_CATEGORIES
    for category in ALL_APP_LOG_CATEGORIES:
        assert normalize_log_category(category) == category
    assert normalize_log_category("nope") == "system"

    fields = AppLogEntryResponse.model_fields
    assert get_args(fields["category"].annotation) == ALL_APP_LOG_CATEGORIES
    assert get_args(fields["level"].annotation) == ALL_APP_LOG_LEVELS


def test_json_modes_match_ddl_check() -> None:
    values = _check_values(
        llm_ddl.DDL,
        r"json_mode\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'disabled'\s+"
        r"CHECK\s+\(\s*json_mode\s+IN\s+\(([^)]+)\)\s*\)",
        "llm_profiles.json_mode",
    )
    assert values == ALLOWED_JSON_MODES
    assert JSON_MODE_CHECK_SQL in llm_ddl.DDL
    assert set(ALL_JSON_MODES) == ALLOWED_JSON_MODES


def test_web_search_providers_match_ddl_check_and_routing() -> None:
    from server.agent.web_search_routing import normalize_web_search_setting

    values = _check_values(
        llm_ddl.DDL,
        r"web_search_provider\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'auto'\s+"
        r"CHECK\s+\(\s*web_search_provider\s+IN\s+\(([^)]+)\)\s*\)",
        "llm_profiles.web_search_provider",
    )
    assert values == ALLOWED_WEB_SEARCH_PROVIDERS
    assert WEB_SEARCH_PROVIDER_CHECK_SQL in llm_ddl.DDL
    assert set(ALL_WEB_SEARCH_PROVIDERS) == ALLOWED_WEB_SEARCH_PROVIDERS
    for provider in ALL_WEB_SEARCH_PROVIDERS:
        assert normalize_web_search_setting(provider) == provider
    from server.api.schemas.requests.llm_profiles import LlmProfileUpsertBody
    from server.api.schemas.responses.llm_profiles import LlmProfileResponse

    assert tuple(f"{provider}_search_api_key" for provider in KEYED_WEB_SEARCH_PROVIDERS) == WEB_SEARCH_SECRET_COLUMNS
    assert tuple(wire for _, wire in WEB_SEARCH_SECRET_WIRE_FIELDS) == WEB_SEARCH_SECRET_WIRE_NAMES
    for wire in WEB_SEARCH_SECRET_WIRE_NAMES:
        assert wire in LlmProfileUpsertBody.model_fields
        assert wire in LlmProfileResponse.model_fields
    for column in WEB_SEARCH_SECRET_COLUMNS:
        assert column in llm_ddl.DDL
        assert llm_ddl.DDL.count(column) == 1


def test_analysis_strategy_modes_match_ddl_check_and_prompts() -> None:
    from server.prompts.analysis import STRATEGY_INSTRUCTIONS
    from server.scheduler.task_schedule_overrides import ALLOWED_STRATEGY_MODES

    values = _check_values(
        tasks_ddl.DDL,
        r"analysis_strategy_mode\s+TEXT\s+DEFAULT\s+NULL\s+"
        r"CHECK\s+\(\s*analysis_strategy_mode\s+IN\s+\(([^)]+)\)\s*\)",
        "analysis_tasks.analysis_strategy_mode",
    )
    assert values == ALLOWED_ANALYSIS_STRATEGY_MODES
    assert ANALYSIS_STRATEGY_MODE_CHECK_SQL in tasks_ddl.DDL
    assert set(ALL_ANALYSIS_STRATEGY_MODES) == ALLOWED_ANALYSIS_STRATEGY_MODES
    assert frozenset(STRATEGY_INSTRUCTIONS) == ALLOWED_ANALYSIS_STRATEGY_MODES
    assert ALLOWED_STRATEGY_MODES == ALLOWED_ANALYSIS_STRATEGY_MODES
