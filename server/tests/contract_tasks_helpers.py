"""Shared keys/helpers for split test_contract_tasks_* modules."""

from __future__ import annotations

from server.tests.contract_helpers import assert_keys

TASK_KEYS = [
    "id",
    "name",
    "description",
    "promptTemplate",
    "analysisMode",
    "analysisTimeRange",
    "isActive",
    "channelIds",
    "scheduleRrule",
    "includeInTimeline",
    "worksetId",
    "llmProfileId",
    "notifyPref",
    "emoji",
]

SCHEDULE_KEYS = [
    "taskId",
    "rrule",
    "eventStartTime",
    "eventEndTime",
    "eventIsAllDay",
    "eventLocation",
    "eventDescription",
]


def assert_validation_error(response, expected_message: str) -> None:
    assert response.status_code == 422
    body = response.json()
    assert_keys(body, ["error_code", "message", "details", "correlation_id"], "ValidationError")
    assert body["error_code"] == "VALIDATION_ERROR"
    assert body["message"] == expected_message
    assert body["details"] is None
    assert isinstance(body["correlation_id"], str) and body["correlation_id"]
