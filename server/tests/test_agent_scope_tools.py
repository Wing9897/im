"""Project-scoped calendar tools: ownership gate + child recurring parent_task_id."""

from __future__ import annotations

import pytest

from server.agent.tools_registry import execute_tool
from server.db.database import Database, TransactionDb
from server.domain.agent_task_spec import agent_preset_spec, agent_spec_to_db_kwargs
from server.domain.analysis_modes import AGENT_MODE
from server.llm_profiles_const import DEFAULT_LLM_PROFILE_ID
from server.queries.tasks_queries import insert_analysis_task
from server.services.recurring_series_writes import create_recurring_series
from server.util import utc_now_iso


async def _insert_task(
    db: Database,
    *,
    task_id: str,
    mode: str,
    name: str = "t",
) -> None:
    now = utc_now_iso()
    policy: dict = {}
    if mode == AGENT_MODE or mode == "agent":
        policy = agent_spec_to_db_kwargs(agent_preset_spec("project_reconcile", has_channels=True))
        mode = AGENT_MODE
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await insert_analysis_task(
            tx,
            task_id=task_id,
            name=name,
            description=None,
            prompt_template="goals",
            analysis_mode=mode,
            analysis_time_range="all",
            schedule_rrule="FREQ=HOURLY",
            llm_profile_id=DEFAULT_LLM_PROFILE_ID,
            now=now,
            **policy,
        )


async def _insert_series(
    db: Database,
    *,
    name: str,
    parent_task_id: str | None = None,
) -> dict:
    return await create_recurring_series(
        db,
        name=name,
        rrule="FREQ=WEEKLY;BYDAY=TU",
        event_start_time="10:00",
        parent_task_id=parent_task_id,
    )


@pytest.mark.asyncio
async def test_agent_create_recurring_task_sets_parent(app) -> None:
    db: Database = app.state.db
    await _insert_task(db, task_id="proj-1", mode="agent", name="Alpha")

    result = await execute_tool(
        db,
        "calendar.create_recurring_series",
        {
            "name": "Weekly sync",
            "rrule": "FREQ=WEEKLY;BYDAY=MO",
            "eventStartTime": "09:30",
        },
        context={"agent_scope_task_id": "proj-1"},
    )
    assert "error" not in result
    task = result["series"]
    assert "analysisMode" not in task
    assert task["parentTaskId"] == "proj-1"

    row = await db.fetch_one(
        "SELECT parent_task_id FROM recurring_schedules WHERE id = ?",
        (task["id"],),
    )
    assert row is not None
    assert row["parent_task_id"] == "proj-1"


@pytest.mark.asyncio
async def test_agent_update_rejects_foreign_recurring(app) -> None:
    db: Database = app.state.db
    await _insert_task(db, task_id="proj-1", mode="agent", name="Alpha")
    orphan = await _insert_series(db, name="Orphan")

    result = await execute_tool(
        db,
        "calendar.update_recurring_series",
        {"id": orphan["id"], "name": "Hijack"},
        context={"agent_scope_task_id": "proj-1"},
    )
    assert result.get("error")
    assert "parent_task_id" in str(result["error"])


@pytest.mark.asyncio
async def test_agent_delete_allows_owned_child(app) -> None:
    db: Database = app.state.db
    await _insert_task(db, task_id="proj-1", mode="agent", name="Alpha")
    child = await _insert_series(db, name="Child", parent_task_id="proj-1")

    result = await execute_tool(
        db,
        "calendar.delete_recurring_series",
        {"id": child["id"]},
        context={"agent_scope_task_id": "proj-1"},
    )
    assert result.get("deleted") is True
    assert "soft" not in result
    remaining = await db.fetch_value(
        "SELECT COUNT(*) FROM recurring_schedules WHERE id = ?",
        (child["id"],),
    )
    assert int(remaining) == 0


@pytest.mark.asyncio
async def test_agent_list_calendars_include_inactive_child(app) -> None:
    db: Database = app.state.db
    await _insert_task(db, task_id="proj-1", mode="agent", name="Alpha")
    child = await _insert_series(db, name="Paused child", parent_task_id="proj-1")
    await execute_tool(
        db,
        "calendar.update_recurring_series",
        {"id": child["id"], "isActive": False},
        context={"agent_scope_task_id": "proj-1"},
    )

    default = await execute_tool(
        db,
        "calendar.list_calendars",
        {},
        context={"agent_scope_task_id": "proj-1"},
    )
    assert not any(c["id"] == child["id"] for c in default["calendars"])

    with_inactive = await execute_tool(
        db,
        "calendar.list_calendars",
        {"includeInactive": True},
        context={"agent_scope_task_id": "proj-1"},
    )
    match = next(c for c in with_inactive["calendars"] if c["id"] == child["id"])
    assert match["isActive"] is False
    assert match["kind"] == "recurring_series"


@pytest.mark.asyncio
async def test_user_event_may_own_agent_task(app) -> None:
    db: Database = app.state.db
    await _insert_task(db, task_id="agent-1", mode="agent", name="Alpha")

    result = await execute_tool(
        db,
        "calendar.create_event",
        {
            "title": "Kickoff",
            "startTime": "2026-07-28T10:00:00Z",
        },
        context={
            "agent_scope_task_id": "agent-1",
            "user_event_origin": "agent",
        },
    )
    assert "error" not in result
    assert result["item"]["taskId"] == "agent-1"
    assert result["item"]["origin"] == "agent"
