"""Agent intelligence.search_events tool (analysis key events)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from server.agent.tools_intelligence import HARD_CAP, execute_intelligence_tool
from server.agent.tools_registry import build_tool_schemas, execute_tool
from server.analyzer.incremental import time_range_lower_bound
from server.tests import seed
from server.time_iso import parse_iso, to_iso_z


def test_time_range_lower_bound_mirrors_offset_map() -> None:
    frozen = datetime(2026, 9, 2, 15, 30, 0, tzinfo=UTC)
    assert time_range_lower_bound("today", now=frozen) == datetime(2026, 9, 2, 0, 0, 0, tzinfo=UTC)
    assert time_range_lower_bound("7d", now=frozen) == datetime(2026, 8, 26, 15, 30, 0, tzinfo=UTC)
    assert time_range_lower_bound("12h", now=frozen) == datetime(2026, 9, 2, 3, 30, 0, tzinfo=UTC)
    assert time_range_lower_bound("all", now=frozen) is None
    assert time_range_lower_bound("alltime", now=frozen) is None


async def test_intelligence_search_defaults_to_7d_window(app) -> None:
    result = await execute_intelligence_tool(app.state.db, "intelligence.search_events", {})
    assert "error" not in result
    assert result["allTime"] is False
    assert result["startDate"] is not None
    assert result["endDate"] is None
    # Seed events created_at is 2026-07-01; outside a live last-7-days window.
    ids = {item["id"] for item in result["items"]}
    assert "ben-1" not in ids
    assert "ev-1" not in ids


async def test_intelligence_search_all_time_lists_seed(app) -> None:
    result = await execute_intelligence_tool(
        app.state.db,
        "intelligence.search_events",
        {"allTime": True},
    )
    assert "error" not in result
    assert result["allTime"] is True
    assert result["startDate"] is None
    assert result["count"] >= 1
    ids = {item["id"] for item in result["items"]}
    assert "ben-1" in ids
    assert "ev-1" in ids


async def test_intelligence_search_time_range_all_alias(app) -> None:
    result = await execute_intelligence_tool(
        app.state.db,
        "intelligence.search_events",
        {"timeRange": "all"},
    )
    assert "error" not in result
    assert result["allTime"] is True
    assert result["startDate"] is None
    assert result["endDate"] is None
    assert any(item["id"] == "ben-1" for item in result["items"])


async def test_intelligence_search_time_range_7d_coerces_to_start_date(app) -> None:
    result = await execute_intelligence_tool(
        app.state.db,
        "intelligence.search_events",
        {"timeRange": "7d"},
    )
    assert "error" not in result
    assert result["allTime"] is False
    assert result["startDate"] is not None
    assert result["endDate"] is None
    start = parse_iso(result["startDate"])
    assert start is not None
    delta = datetime.now(UTC) - start
    assert timedelta(days=6, hours=23) <= delta <= timedelta(days=7, minutes=1)
    ids = {item["id"] for item in result["items"]}
    assert "ben-1" not in ids
    assert "ev-1" not in ids


async def test_intelligence_search_time_range_today_coerces_to_start_of_day(app) -> None:
    now = datetime.now(UTC)
    today_iso = to_iso_z(now)
    await app.state.db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, "
        "content_hash, semantic_hash, location, source_message_id, created_at, updated_at) "
        "VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            "ev-today-agent",
            seed.TASK_EVENT,
            seed.BATCH_EVENT,
            "今日情報",
            "agent-today-window-hit",
            "hash-today-agent",
            "sem-today-agent",
            "N/A",
            seed.MESSAGE_1,
            today_iso,
            today_iso,
        ),
    )
    result = await execute_intelligence_tool(
        app.state.db,
        "intelligence.search_events",
        {"time_range": "today"},
    )
    assert "error" not in result
    assert result["allTime"] is False
    start = parse_iso(result["startDate"])
    assert start is not None
    assert start == now.replace(hour=0, minute=0, second=0, microsecond=0)
    ids = {item["id"] for item in result["items"]}
    assert "ev-today-agent" in ids
    assert "ben-1" not in ids
    assert "ev-1" not in ids


async def test_intelligence_search_explicit_dates_win_over_time_range(app) -> None:
    result = await execute_intelligence_tool(
        app.state.db,
        "intelligence.search_events",
        {
            "timeRange": "today",
            "startDate": "2026-07-01T00:00:00Z",
            "endDate": "2026-07-02T23:59:59Z",
        },
    )
    assert "error" not in result
    assert result["startDate"] == "2026-07-01T00:00:00Z"
    assert result["endDate"] == "2026-07-02T23:59:59Z"
    ids = {item["id"] for item in result["items"]}
    assert "ben-1" in ids or "ev-1" in ids


async def test_intelligence_search_rejects_removed_full_history_alias(app) -> None:
    removed_token = "".join(("all", "time"))
    result = await execute_intelligence_tool(
        app.state.db,
        "intelligence.search_events",
        {"timeRange": removed_token},
    )
    assert "error" in result
    assert result["items"] == []
    assert result["count"] == 0


async def test_intelligence_search_preserves_snake_case_argument_alias(app) -> None:
    result = await execute_intelligence_tool(
        app.state.db,
        "intelligence.search_events",
        {"all_time": True},
    )
    assert result["allTime"] is True
    assert any(item["id"] == "ben-1" for item in result["items"])


async def test_intelligence_search_7d_finds_recent_event(app) -> None:
    recent = to_iso_z(datetime.now(UTC) - timedelta(days=1))
    await app.state.db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, "
        "content_hash, semantic_hash, location, source_message_id, created_at, updated_at) "
        "VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            "ev-recent-agent",
            seed.TASK_EVENT,
            seed.BATCH_EVENT,
            "近期情報",
            "agent-default-window-hit",
            "hash-recent-agent",
            "sem-recent-agent",
            "N/A",
            seed.MESSAGE_1,
            recent,
            recent,
        ),
    )
    result = await execute_intelligence_tool(
        app.state.db,
        "intelligence.search_events",
        {"query": "agent-default-window-hit"},
    )
    assert result["allTime"] is False
    assert result["startDate"] is not None
    assert any(item["id"] == "ev-recent-agent" for item in result["items"])


async def test_intelligence_search_finds_untimed_by_keyword(app) -> None:
    result = await execute_intelligence_tool(
        app.state.db,
        "intelligence.search_events",
        {"query": "演唱會", "limit": 10, "allTime": True},
    )
    assert "error" not in result
    assert result["count"] >= 1
    item = next(i for i in result["items"] if i["id"] == "ben-1")
    assert item["title"] == "免費演唱會"
    assert item.get("startTime") in (None, "")
    assert "latitude" not in item
    assert "participants" not in item


async def test_intelligence_search_has_time_filter(app) -> None:
    timed = await execute_intelligence_tool(
        app.state.db,
        "intelligence.search_events",
        {"hasTime": True, "limit": 20, "allTime": True},
    )
    assert all(item.get("startTime") for item in timed["items"])
    assert any(item["id"] == "ev-1" for item in timed["items"])

    untimed = await execute_intelligence_tool(
        app.state.db,
        "intelligence.search_events",
        {"hasTime": False, "limit": 20, "allTime": True},
    )
    assert all(not item.get("startTime") for item in untimed["items"])
    assert any(item["id"] == "ben-1" for item in untimed["items"])


async def test_intelligence_search_task_id_filter(app) -> None:
    result = await execute_intelligence_tool(
        app.state.db,
        "intelligence.search_events",
        {"taskId": seed.TASK_EVENT, "limit": 20, "allTime": True},
    )
    assert result["count"] >= 1
    assert all(item["taskId"] == seed.TASK_EVENT for item in result["items"])
    assert any(item["id"] == "ben-1" for item in result["items"])


async def test_intelligence_search_hard_caps_limit(app) -> None:
    result = await execute_intelligence_tool(
        app.state.db,
        "intelligence.search_events",
        {"limit": 10_000, "allTime": True},
    )
    assert result["limit"] == HARD_CAP
    assert len(result["items"]) <= HARD_CAP


async def test_intelligence_search_rejects_oversized_query(app) -> None:
    result = await execute_intelligence_tool(
        app.state.db,
        "intelligence.search_events",
        {"query": "x" * 501, "allTime": True},
    )
    assert "error" in result
    assert result["count"] == 0


async def test_registry_dispatches_intelligence_search(app) -> None:
    result = await execute_tool(
        app.state.db,
        "intelligence.search_events",
        {"query": "季度", "allTime": True},
        context={},
    )
    assert result["count"] >= 1
    assert any(item["id"] == "ev-1" for item in result["items"])


def test_build_tool_schemas_includes_intelligence_search() -> None:
    names = {s["name"] for s in build_tool_schemas(web_search_enabled=False)}
    assert "intelligence.search_events" in names
    assert "messages.search" in names
    messages_schema = next(s for s in build_tool_schemas(web_search_enabled=False) if s["name"] == "messages.search")
    assert "7d" in messages_schema["description"]
    intel_schema = next(
        s for s in build_tool_schemas(web_search_enabled=False) if s["name"] == "intelligence.search_events"
    )
    assert "allTime" in intel_schema["parameters"]["properties"]
    time_range_schema = intel_schema["parameters"]["properties"]["timeRange"]
    assert "enum" not in time_range_schema
    assert "today" in time_range_schema["description"]
    assert "7d" in time_range_schema["description"]
