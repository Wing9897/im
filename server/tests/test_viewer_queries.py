"""Unit tests for viewer aggregate queries."""

from __future__ import annotations

import pytest

from server.queries.viewer_queries import fetch_viewer_stats


@pytest.fixture
async def db(app):
    return app.state.db


async def test_fetch_viewer_stats_matches_seed(db):
    stats = await fetch_viewer_stats(db)
    assert stats["totalTasks"] == 4
    assert stats["activeTasks"] == 4
    assert stats["totalBatches"] >= 1
    assert stats["completedBatches"] >= 1
    assert stats["totalResults"] == 4  # 2 topics + 1 benefit + 1 schedule event
