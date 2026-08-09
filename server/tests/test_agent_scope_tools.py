"""Project-scoped calendar tools: ownership gate + child recurring parent_task_id."""

from __future__ import annotations

import pytest

from server.agent.tools_registry import execute_tool
from server.db.database import Database, TransactionDb
from server.domain.agent_task_spec import agent_preset_spec, agent_spec_to_db_kwargs
from server.domain.analysis_modes import AGENT_MODE
from server.queries.tasks_queries import insert_analysis_task
from server.util import utc_now_iso


async def _insert_task(
    db: Database,
    *,
    task_id: str,
    mode: str,
    name: str = "t",
    parent_task_id: str | None = None,
    rrule: str | None = None,
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
            schedule_rrule=("FREQ=HOURLY" if mode == AGENT_MODE else "FREQ=SECONDLY;INTERVAL=10"),
            rrule=rrule,
            event_start_time="10:00" if rrule else None,
            event_end_time=None,
            event_is_all_day=0,
            event_location=None,
            event_description=None,
            parent_task_id=parent_task_id,
            now=now,
            **policy,
        )


@pytest.mark.asyncio
async def test_agent_create_recurring_task_sets_parent(app) -> None:
    db: Database = app.state.db
    await _insert_task(db, task_id="proj-1", mode="agent", name="Alpha")

    result = await execute_tool(
        db,
        "calendar.create_recurring_task",
        {
            "name": "Weekly sync",
            "rrule": "FREQ=WEEKLY;BYDAY=MO",
            "eventStartTime": "09:30",
        },
        context={"agent_scope_task_id": "proj-1"},
    )
    assert "error" not in result
    task = result["task"]
    assert task["analysisMode"] == "recurring"
    assert task["parentTaskId"] == "proj-1"

    row = await db.fetch_one(
        "SELECT rs.parent_task_id, t.analysis_mode FROM analysis_tasks t "
        "JOIN recurring_schedules rs ON rs.task_id = t.id WHERE t.id = ?",
        (task["id"],),
    )
    assert row is not None
    assert row["parent_task_id"] == "proj-1"
    assert row["analysis_mode"] == "recurring"


@pytest.mark.asyncio
async def test_agent_update_rejects_foreign_recurring(app) -> None:
    db: Database = app.state.db
    await _insert_task(db, task_id="proj-1", mode="agent", name="Alpha")
    await _insert_task(
        db,
        task_id="orphan-rec",
        mode="recurring",
        name="Orphan",
        rrule="FREQ=DAILY",
    )

    result = await execute_tool(
        db,
        "calendar.update_recurring_task",
        {"id": "orphan-rec", "name": "Hijack"},
        context={"agent_scope_task_id": "proj-1"},
    )
    assert result.get("error")
    assert "parent_task_id" in str(result["error"])


@pytest.mark.asyncio
async def test_agent_delete_allows_owned_child(app) -> None:
    db: Database = app.state.db
    await _insert_task(db, task_id="proj-1", mode="agent", name="Alpha")
    await _insert_task(
        db,
        task_id="child-rec",
        mode="recurring",
        name="Child",
        parent_task_id="proj-1",
        rrule="FREQ=WEEKLY;BYDAY=TU",
    )

    result = await execute_tool(
        db,
        "calendar.delete_recurring_task",
        {"id": "child-rec"},
        context={"agent_scope_task_id": "proj-1"},
    )
    assert result.get("deleted") is True
    assert result.get("soft") is True
    active = await db.fetch_value(
        "SELECT is_active FROM analysis_tasks WHERE id = ?",
        ("child-rec",),
    )
    assert int(active) == 0


@pytest.mark.asyncio
async def test_user_event_may_own_project_task(app) -> None:
    db: Database = app.state.db
    await _insert_task(db, task_id="proj-1", mode="agent", name="Alpha")

    result = await execute_tool(
        db,
        "calendar.create_event",
        {
            "title": "Kickoff",
            "startTime": "2026-07-28T10:00:00Z",
        },
        context={
            "agent_scope_task_id": "proj-1",
            "user_event_origin": "agent",
        },
    )
    assert "error" not in result
    assert result["item"]["taskId"] == "proj-1"
    assert result["item"]["origin"] == "agent"
