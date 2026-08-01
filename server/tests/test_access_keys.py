"""Tests for server.auth.access_keys."""

from __future__ import annotations

import pytest

from server.auth.access_keys import (
    READ_SCOPE,
    access_key_allows_method,
    access_key_path_allowed,
    create_access_key,
    is_valid_access_token,
    list_access_keys_public,
    resolve_access_token,
    revoke_access_key,
    seed_access_key,
    touch_access_key_last_used,
)
from server.config import get_config


@pytest.mark.asyncio
async def test_create_list_revoke_access_key(app) -> None:
    db = app.state.db
    created = await create_access_key(db, "Tablet")
    assert created["key"]
    assert created["label"] == "Tablet"
    assert created["scopes"] == ["*"]

    listed = await list_access_keys_public(db)
    assert len(listed) == 1
    assert listed[0]["id"] == created["id"]
    assert listed[0]["scopes"] == ["*"]
    assert "key" not in listed[0]

    assert await is_valid_access_token(db, created["key"]) is True
    assert await is_valid_access_token(db, "wrong") is False

    assert await revoke_access_key(db, created["id"]) is True
    assert await is_valid_access_token(db, created["key"]) is False
    assert await list_access_keys_public(db) == []


@pytest.mark.asyncio
async def test_resolve_access_token_and_read_only_create(app) -> None:
    db = app.state.db
    created = await create_access_key(db, "Viewer", scopes=[READ_SCOPE])
    resolved = await resolve_access_token(db, created["key"])
    assert resolved is not None
    assert resolved["id"] == created["id"]
    assert resolved["scopes"] == [READ_SCOPE]

    await touch_access_key_last_used(db, created["id"])
    listed = await list_access_keys_public(db)
    assert listed[0]["lastUsedAt"]


@pytest.mark.asyncio
async def test_create_rejects_retired_a2a_scopes(app) -> None:
    db = app.state.db
    with pytest.raises(ValueError, match="a2a:events"):
        await create_access_key(db, "Legacy", scopes=["a2a:events"])
    with pytest.raises(ValueError, match="a2a:agent"):
        await create_access_key(db, "LegacyAgent", scopes=["a2a:agent"])
    assert await list_access_keys_public(db) == []


def test_access_key_method_and_path_helpers() -> None:
    assert access_key_allows_method("GET", ["*"]) is True
    assert access_key_allows_method("POST", ["*"]) is True
    assert access_key_allows_method("GET", [READ_SCOPE]) is True
    assert access_key_allows_method("POST", [READ_SCOPE]) is False
    assert access_key_path_allowed("/api/v1/tasks", ["*"]) is True
    assert access_key_path_allowed("/api/v1/tasks", [READ_SCOPE]) is True


@pytest.mark.asyncio
async def test_hash_lookup_does_not_store_plaintext(app) -> None:
    db = app.state.db
    created = await seed_access_key(db, "plain-secret-token-value", label="Seed")
    row = await db.fetch_one(
        "SELECT secret_hash, preview FROM access_api_keys WHERE id = ?",
        (created["id"],),
    )
    assert row is not None
    assert "plain-secret-token-value" not in str(row["secret_hash"])
    assert await is_valid_access_token(db, "plain-secret-token-value") is True
    assert await get_config(db, "access_api_keys") == ""
    assert await get_config(db, "ingestion_api_key") == ""
