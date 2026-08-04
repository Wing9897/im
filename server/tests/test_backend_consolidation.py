"""Focused drift tests for backend single-source policies."""

from __future__ import annotations

import re
from pathlib import Path
from typing import get_args

from server.agent.tool_limits import (
    CALENDAR_RESULT_HARD_CAP,
    INTELLIGENCE_RESULT_HARD_CAP,
    MESSAGES_RESULT_HARD_CAP,
)
from server.agent.tools_calendar.schemas import TOOL_SCHEMAS as CALENDAR_SCHEMAS
from server.agent.tools_intelligence import TOOL_SCHEMAS as INTELLIGENCE_SCHEMAS
from server.agent.tools_messages import TOOL_SCHEMAS as MESSAGE_SCHEMAS
from server.api.routes.tasks import TaskConfigBody
from server.api.schemas.responses.tasks import TaskResponse
from server.domain.analysis_modes import (
    AI_ANALYSIS_MODES,
    ALL_ANALYSIS_MODES,
    MESSAGE_BATCH_ANALYSIS_MODES,
    SCHEDULABLE_ANALYSIS_MODES,
    AnalysisMode,
)
from server.prompts.assistant import TASK_CONFIG_SCHEMA_PROMPT
from server.app_logging import clear_app_logs, record_and_fetch
from server.queries.logs_queries import fetch_app_logs_page


def _limit_maximum(schemas: list[dict], name: str) -> int:
    schema = next(item for item in schemas if item["name"] == name)
    return int(schema["parameters"]["properties"]["limit"]["maximum"])


def test_analysis_mode_consumers_share_domain_vocabulary() -> None:
    expected = tuple(get_args(AnalysisMode))
    assert expected == ALL_ANALYSIS_MODES
    assert set(MESSAGE_BATCH_ANALYSIS_MODES) <= set(AI_ANALYSIS_MODES)
    assert set(SCHEDULABLE_ANALYSIS_MODES) == set(AI_ANALYSIS_MODES)
    assert all(repr(mode) in TASK_CONFIG_SCHEMA_PROMPT for mode in expected)

    for model in (TaskConfigBody, TaskResponse):
        schema = model.model_json_schema()
        mode_schema = schema["properties"]["analysisMode"]
        enum = mode_schema.get("enum")
        if enum is None:
            enum = next(branch["enum"] for branch in mode_schema["anyOf"] if "enum" in branch)
        assert tuple(enum) == expected


def test_analysis_mode_specs_drive_capability_sets() -> None:
    from server.domain.analysis_modes import (
        ANALYSIS_MODE_SPECS,
        NON_SCHEDULABLE_ANALYSIS_MODES,
        SKIP_BATCH_ANALYSIS_MODES,
        TIMELINE_OWNING_ANALYSIS_MODES,
        get_analysis_mode_spec,
    )

    assert tuple(spec.mode for spec in ANALYSIS_MODE_SPECS) == ALL_ANALYSIS_MODES
    for spec in ANALYSIS_MODE_SPECS:
        assert get_analysis_mode_spec(spec.mode) is spec
        assert (spec.mode in AI_ANALYSIS_MODES) is spec.ai
        assert (spec.mode in SCHEDULABLE_ANALYSIS_MODES) is spec.schedulable
        assert (spec.mode in MESSAGE_BATCH_ANALYSIS_MODES) is spec.message_batch
        assert (spec.mode in TIMELINE_OWNING_ANALYSIS_MODES) is spec.timeline_owning
        assert (spec.mode in NON_SCHEDULABLE_ANALYSIS_MODES) is (not spec.schedulable)
        assert (spec.mode in SKIP_BATCH_ANALYSIS_MODES) is (not spec.message_batch)
        if spec.pipeline == "message_batch":
            assert spec.message_batch and spec.ai and spec.schedulable
        elif spec.pipeline == "project_tick":
            assert spec.ai and spec.schedulable and not spec.message_batch
        elif spec.pipeline == "web_intel_tick":
            assert spec.ai and spec.schedulable and not spec.message_batch and spec.timeline_owning
        elif spec.pipeline == "rrule_expand":
            assert not spec.ai and not spec.schedulable and not spec.message_batch
        else:
            raise AssertionError(f"unexpected pipeline: {spec.pipeline}")
    assert get_analysis_mode_spec("nope") is None


def test_collector_adapter_registry_matches_schema_platforms() -> None:
    from typing import get_args as typing_get_args

    from server.api.schemas.responses.accounts import AccountPlatform
    from server.collector.adapter_factory import (
        ADAPTER_BUILDERS,
        REGISTERED_COLLECTOR_PLATFORMS,
    )
    from server.db.schema_ddl import (
        ANALYSIS_MODE_CHECK_VALUES,
        PLATFORM_CHECK_VALUES,
    )
    from server.domain.collector_platforms import (
        COLLECTOR_PLATFORMS,
        COLLECTOR_PLATFORMS_WITH_LIST_ENRICHMENT,
    )

    assert COLLECTOR_PLATFORMS == PLATFORM_CHECK_VALUES == REGISTERED_COLLECTOR_PLATFORMS
    assert tuple(ADAPTER_BUILDERS) == COLLECTOR_PLATFORMS
    assert ANALYSIS_MODE_CHECK_VALUES == ALL_ANALYSIS_MODES
    assert tuple(typing_get_args(AccountPlatform)) == COLLECTOR_PLATFORMS
    assert COLLECTOR_PLATFORMS_WITH_LIST_ENRICHMENT == frozenset(COLLECTOR_PLATFORMS) - {"telegram"}


def _parse_ts_string_array(path: Path, const_name: str) -> tuple[str, ...]:
    text = path.read_text(encoding="utf-8")
    match = re.search(
        rf"export const {re.escape(const_name)}\s*=\s*\[(.*?)\]\s*as const",
        text,
        flags=re.DOTALL,
    )
    assert match is not None, f"{const_name} not found in {path}"
    return tuple(re.findall(r'"([^"]+)"', match.group(1)))


def _parse_ts_capability_booleans(path: Path) -> dict[str, dict[str, bool | str]]:
    """Parse ANALYSIS_MODE_CAPABILITIES entries (ai/schedulable/messageBatch/timelineOwning/pipeline)."""
    text = path.read_text(encoding="utf-8")
    block = re.search(
        r"export const ANALYSIS_MODE_CAPABILITIES[^=]*=\s*\{(.*)\n\}\s*;",
        text,
        flags=re.DOTALL,
    )
    assert block is not None
    body = block.group(1)
    out: dict[str, dict[str, bool | str]] = {}
    for mode_match in re.finditer(
        r"(\w+)\s*:\s*\{([^}]+)\}",
        body,
    ):
        mode = mode_match.group(1)
        fields = mode_match.group(2)
        entry: dict[str, bool | str] = {}
        for key, raw in re.findall(r"(\w+)\s*:\s*([^,\n]+)", fields):
            value = raw.strip().rstrip(",")
            if value in {"true", "false"}:
                entry[key] = value == "true"
            else:
                entry[key] = value.strip('"')
        out[mode] = entry
    return out


def test_fe_mirrors_analysis_mode_and_collector_registries() -> None:
    from server.db.schema_ddl import ANALYSIS_TIME_RANGE_VALUES
    from server.domain.analysis_modes import ANALYSIS_MODE_SPECS

    root = Path(__file__).resolve().parents[2]
    mode_caps_path = root / "web" / "src" / "domain" / "tasks" / "analysisModeCapabilities.ts"
    platform_path = root / "web" / "src" / "domain" / "sources" / "collectorPlatforms.ts"
    task_range_path = root / "web" / "src" / "domain" / "tasks" / "taskAnalysisTimeRange.ts"

    fe_modes = _parse_ts_string_array(mode_caps_path, "ANALYSIS_MODE_ORDER")
    assert fe_modes == ALL_ANALYSIS_MODES

    fe_platforms = _parse_ts_string_array(platform_path, "COLLECTOR_PLATFORM_ORDER")
    assert fe_platforms == tuple(
        __import__("server.domain.collector_platforms", fromlist=["COLLECTOR_PLATFORMS"]).COLLECTOR_PLATFORMS
    )

    fe_task_ranges = _parse_ts_string_array(task_range_path, "TASK_ANALYSIS_TIME_RANGE_VALUES")
    assert fe_task_ranges == ANALYSIS_TIME_RANGE_VALUES
    assert "12h" not in fe_task_ranges
    assert "24h" not in fe_task_ranges
    for value in ANALYSIS_TIME_RANGE_VALUES:
        assert repr(value) in TASK_CONFIG_SCHEMA_PROMPT

    fe_caps = _parse_ts_capability_booleans(mode_caps_path)
    assert set(fe_caps) == set(ALL_ANALYSIS_MODES)
    for spec in ANALYSIS_MODE_SPECS:
        entry = fe_caps[spec.mode]
        assert entry["ai"] is spec.ai
        assert entry["schedulable"] is spec.schedulable
        assert entry["messageBatch"] is spec.message_batch
        assert entry["timelineOwning"] is spec.timeline_owning
        assert entry["pipeline"] == spec.pipeline


def test_agent_tool_schema_caps_share_named_policy_constants() -> None:
    for name in ("calendar.upcoming", "calendar.recent", "calendar.window"):
        assert _limit_maximum(CALENDAR_SCHEMAS, name) == CALENDAR_RESULT_HARD_CAP
    assert _limit_maximum(MESSAGE_SCHEMAS, "messages.search") == MESSAGES_RESULT_HARD_CAP
    assert _limit_maximum(INTELLIGENCE_SCHEMAS, "intelligence.search_events") == INTELLIGENCE_RESULT_HARD_CAP
    assert CALENDAR_RESULT_HARD_CAP > MESSAGES_RESULT_HARD_CAP
    assert MESSAGES_RESULT_HARD_CAP == INTELLIGENCE_RESULT_HARD_CAP


async def test_log_queries_and_write_service_preserve_route_shape(app) -> None:
    db = app.state.db
    await clear_app_logs(db)
    created = await record_and_fetch(
        db,
        level="info",
        category="system",
        kind="system.test",
        message="query boundary",
    )
    rows, has_more, total = await fetch_app_logs_page(
        db,
        cursor_time=None,
        cursor_id=None,
        limit=50,
    )
    assert created["id"] == rows[0]["id"]
    assert created["kind"] == "system.test"
    assert has_more is False
    assert total == 1


async def test_empty_user_event_patch_uses_canonical_dismissal_serialization(client) -> None:
    created = await client.post(
        "/api/v1/calendar/user-events",
        json={"title": "canonical", "startTime": "2026-07-28T09:00:00Z"},
    )
    event_id = created.json()["id"]
    assert (await client.delete(f"/api/v1/calendar/user-events/{event_id}")).status_code == 204

    response = await client.patch(f"/api/v1/calendar/user-events/{event_id}", json={})
    assert response.status_code == 200
    assert response.json()["dismissed"] is True
