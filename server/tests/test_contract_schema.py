"""Contract keys: schema upgrade gate routes."""

from __future__ import annotations

from server.tests.contract_helpers import assert_keys

SCHEMA_STATUS_KEYS = [
    "state",
    "runtimeReady",
    "schemaVersion",
    "requiredSchemaVersion",
    "schemaSemver",
    "backupPath",
    "error",
    "restoredFromBackup",
    "progress",
]

SCHEMA_PROGRESS_KEYS = ["phase", "percent", "message"]


async def test_schema_status_contract(client):
    resp = await client.get("/api/v1/system/schema/status")
    assert resp.status_code == 200
    body = resp.json()
    assert_keys(body, SCHEMA_STATUS_KEYS, "SchemaUpgradeStatus")
    assert_keys(body["progress"], SCHEMA_PROGRESS_KEYS, "SchemaUpgradeProgress")
