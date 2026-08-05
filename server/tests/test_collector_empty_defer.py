"""Empty-source installs should skip collector settle/auto-connect startup work."""

from __future__ import annotations

import pytest

from server.collector.manager_retry import CollectorRetryOrchestrator


@pytest.mark.asyncio
async def test_start_background_skips_when_no_sources(monkeypatch):
    created: list[object] = []

    def fake_create_task(coro):
        created.append(coro)
        coro.close()
        return object()

    monkeypatch.setattr("server.collector.manager_retry.asyncio.create_task", fake_create_task)

    orch = CollectorRetryOrchestrator(
        db=object(),  # type: ignore[arg-type]
        broadcaster=object(),  # type: ignore[arg-type]
        adapters={},
        session_dir=lambda: ".",
        publish_status=lambda *args, **kwargs: None,  # type: ignore[misc,return-value]
    )
    await orch.start_background([])
    assert created == []
    assert orch.active_task_count == 0
