"""Tests for auto-pause when batch retries are exhausted."""

from __future__ import annotations

import pytest

from server.config import get_config_bool, set_configs
from server.scheduler.batch import execute_batch
from server.tests import seed


class FailingEngine:
    provider = "stub"
    model = "stub-model"

    def __init__(self, message: str):
        self.message = message
        self.calls = 0

    async def analyze(self, prompt, *, profile_id=None):  # noqa: ANN001, ANN201
        self.calls += 1
        raise RuntimeError(self.message)


class RecordingBroadcaster:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict]] = []

    def publish(self, event_type: str, payload: dict) -> None:
        self.events.append((event_type, payload))


class StubScheduler:
    def __init__(self) -> None:
        self._paused = False

    @property
    def paused(self) -> bool:
        return self._paused

    async def pause(self) -> None:
        self._paused = True


@pytest.fixture
async def db(app):
    database = app.state.db
    await set_configs(
        database,
        {
            "analysis_trigger_threshold": "1",
            "analysis_batch_message_limit": "50",
            "max_batch_retries": "1",
            "auto_pause_on_retries_exhausted": "true",
        },
    )
    await database.execute("UPDATE analysis_tasks SET analysis_time_range = 'all'")
    return database


async def test_retries_exhausted_auto_pauses_and_keeps_batch_pending(db, app):
    engine = FailingEngine('LLM request failed with status 429: {"status": "RESOURCE_EXHAUSTED"}')
    broadcaster = RecordingBroadcaster()
    scheduler = StubScheduler()

    await execute_batch(
        db=db,
        broadcaster=broadcaster,
        task_id=seed.TASK_EVENT,
        analysis_engine=engine,
        action_executor=None,
        scheduler=scheduler,
    )

    assert engine.calls == 1
    assert await get_config_bool(db, "analysis_paused") is True
    assert scheduler.paused is True

    pending = await db.fetch_one(
        "SELECT status, retry_count FROM analysis_batches WHERE task_id = ? ORDER BY created_at DESC LIMIT 1",
        (seed.TASK_EVENT,),
    )
    assert pending is not None
    assert pending["status"] == "pending"
    assert int(pending["retry_count"] or 0) == 0


async def test_auto_pause_disabled_keeps_analysis_running(db, app):
    await set_configs(db, {"auto_pause_on_retries_exhausted": "false", "max_batch_retries": "1"})
    engine = FailingEngine("LLM timeout")
    scheduler = StubScheduler()

    await execute_batch(
        db=db,
        broadcaster=RecordingBroadcaster(),
        task_id=seed.TASK_EVENT,
        analysis_engine=engine,
        action_executor=None,
        scheduler=scheduler,
    )

    assert await get_config_bool(db, "analysis_paused") is False
    pending = await db.fetch_one(
        "SELECT status FROM analysis_batches WHERE task_id = ? AND status = 'pending'",
        (seed.TASK_EVENT,),
    )
    assert pending is not None
