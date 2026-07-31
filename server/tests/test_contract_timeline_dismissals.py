"""Public response, query, and error contract for timeline dismissals."""

from __future__ import annotations

from server.tests.contract_helpers import assert_keys

DISMISSAL_KEYS = ["source", "eventId", "dismissedAt"]
ERROR_KEYS = ["error_code", "message", "details", "correlation_id"]


async def test_timeline_dismissal_roundtrip_contract(client) -> None:
    created = await client.put(
        "/api/v1/timeline/dismissals",
        json={"source": "recurring", "eventId": "task-1:20260731T090000Z"},
    )
    assert created.status_code == 200
    created_body = created.json()
    assert_keys(created_body, DISMISSAL_KEYS, "dismissal PUT")
    assert created_body["source"] == "recurring"
    assert created_body["eventId"] == "task-1:20260731T090000Z"

    listed = await client.get(
        "/api/v1/timeline/dismissals",
        params={"source": "recurring"},
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert_keys(listed.json()[0], DISMISSAL_KEYS, "dismissal GET item")

    restored = await client.delete(
        "/api/v1/timeline/dismissals",
        params={"source": "recurring", "eventId": "task-1:20260731T090000Z"},
    )
    assert restored.status_code == 204
    assert restored.content == b""


async def test_timeline_dismissal_validation_errors_are_structured(client) -> None:
    invalid_source = await client.put(
        "/api/v1/timeline/dismissals",
        json={"source": "unknown", "eventId": "event-1"},
    )
    assert invalid_source.status_code == 422
    invalid_source_body = invalid_source.json()
    assert_keys(invalid_source_body, ERROR_KEYS, "invalid dismissal source")
    assert invalid_source_body["error_code"] == "VALIDATION_ERROR"

    empty_event_id = await client.delete(
        "/api/v1/timeline/dismissals",
        params={"source": "analysis", "eventId": " "},
    )
    assert empty_event_id.status_code == 422
    empty_event_body = empty_event_id.json()
    assert_keys(empty_event_body, ERROR_KEYS, "empty dismissal eventId")
    assert empty_event_body["error_code"] == "VALIDATION_ERROR"


async def test_timeline_dismissal_missing_restore_is_structured(client) -> None:
    missing = await client.delete(
        "/api/v1/timeline/dismissals",
        params={"source": "analysis", "eventId": "missing-event"},
    )

    assert missing.status_code == 404
    body = missing.json()
    assert_keys(body, ERROR_KEYS, "missing dismissal")
    assert body["error_code"] == "NOT_FOUND"
