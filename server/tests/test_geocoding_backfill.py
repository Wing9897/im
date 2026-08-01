"""Geocoding backfill batch UPDATE."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from server.analyzer.geocoding import backfill_stored_events
from server.tests import seed


@pytest.fixture
async def db(app):
    return app.state.db


async def _fake_geocode(items):
    for item in items:
        item["latitude"] = 25.0
        item["longitude"] = 121.5
    return items


async def test_backfill_stored_events_batch_update(db):
    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, "
        "content_hash, semantic_hash, location, source_message_id, "
        "batch_source_channel_names, latitude, longitude, created_at, updated_at) "
        "VALUES ('event-geo', ?, 1, ?, 'Geo Item', 'content', 'hash-geo', "
        "'sem-geo', '25.0,121.5', NULL, NULL, NULL, NULL, ?, ?)",
        (
            seed.TASK_EVENT,
            seed.BATCH_EVENT,
            "2026-07-01T12:00:00+00:00",
            "2026-07-01T12:00:00+00:00",
        ),
    )

    with patch("server.analyzer.geocoding.geocode_analysis_items", side_effect=_fake_geocode):
        updated = await backfill_stored_events(db)

    assert updated >= 1
    row = await db.fetch_one("SELECT latitude, longitude FROM analysis_events WHERE id = 'event-geo'")
    assert row is not None
    assert row["latitude"] == 25.0
    assert row["longitude"] == 121.5
