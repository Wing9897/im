"""Structured errors emitted by shared API parsing and lookup helpers."""

from __future__ import annotations

from typing import Any, cast

import pytest
from fastapi import HTTPException

from server.api.channel_refs import parse_channel_key_csv
from server.api.deps import require_row
from server.tests.contract_helpers import assert_keys

ERROR_KEYS = ["error_code", "message", "details", "correlation_id"]
EXCEPTION_DETAIL_KEYS = ["error_code", "message", "details"]


def test_channel_ref_parser_raises_structured_validation_error():
    with pytest.raises(HTTPException) as exc_info:
        parse_channel_key_csv("missing-separator")

    exc = exc_info.value
    assert exc.status_code == 422
    detail = cast(dict[str, Any], exc.detail)
    assert isinstance(detail, dict)
    assert_keys(detail, EXCEPTION_DETAIL_KEYS, "channel parser HTTPException detail")
    assert detail["error_code"] == "VALIDATION_ERROR"
    assert detail["message"] == "Invalid channel key: missing-separator"


async def test_require_row_raises_structured_not_found_error(app):
    with pytest.raises(HTTPException) as exc_info:
        await require_row(app.state.db, "worksets", "Workset", "missing-workset")

    exc = exc_info.value
    assert exc.status_code == 404
    detail = cast(dict[str, Any], exc.detail)
    assert isinstance(detail, dict)
    assert_keys(detail, EXCEPTION_DETAIL_KEYS, "require_row HTTPException detail")
    assert detail["error_code"] == "NOT_FOUND"
    assert detail["message"] == "Workset missing-workset not found"


async def test_shared_helper_errors_keep_public_response_contract(client):
    invalid_channel = await client.get(
        "/api/v1/channels/latest-messages",
        params={"channels": "missing-separator"},
    )
    assert invalid_channel.status_code == 422
    channel_body = invalid_channel.json()
    assert_keys(channel_body, ERROR_KEYS, "channel parser response")
    assert channel_body["error_code"] == "VALIDATION_ERROR"

    missing_row = await client.get("/api/v1/worksets/missing-workset")
    assert missing_row.status_code == 404
    row_body = missing_row.json()
    assert_keys(row_body, ERROR_KEYS, "require_row response")
    assert row_body["error_code"] == "NOT_FOUND"
