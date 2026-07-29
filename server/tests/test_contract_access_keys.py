"""Contract tests for /api/v1/access-keys (list / create / revoke)."""

from __future__ import annotations


async def test_access_keys_crud_contract(client):
    boot = await client.post(
        "/api/v1/setup/register",
        json={"username": "admin", "password": "password1", "label": "Host"},
    )
    assert boot.status_code == 200
    headers = {"Authorization": f"Bearer {boot.json()['accessToken']}"}

    empty = await client.get("/api/v1/access-keys", headers=headers)
    assert empty.status_code == 200
    assert empty.json() == {"keys": []}

    created = await client.post(
        "/api/v1/access-keys",
        headers=headers,
        json={"label": "Webhook"},
    )
    assert created.status_code == 200
    body = created.json()
    assert set(body) >= {"id", "label", "preview", "createdAt", "scopes", "lastUsedAt", "key"}
    assert body["label"] == "Webhook"
    assert body["scopes"] == ["*"]
    assert body["lastUsedAt"] is None
    assert body["key"]
    assert "key" not in (await client.get("/api/v1/access-keys", headers=headers)).json()["keys"][0]

    listed = await client.get("/api/v1/access-keys", headers=headers)
    assert listed.status_code == 200
    keys = listed.json()["keys"]
    assert len(keys) == 1
    assert set(keys[0]) == {"id", "label", "preview", "createdAt", "scopes", "lastUsedAt"}
    assert keys[0]["id"] == body["id"]
    assert keys[0]["scopes"] == ["*"]

    a2a_only = await client.post(
        "/api/v1/access-keys",
        headers=headers,
        json={"label": "A2A", "allowA2aAgent": True},
    )
    assert a2a_only.status_code == 200
    assert a2a_only.json()["scopes"] == ["a2a:agent"]

    # Obsolete create flag is rejected (extra=forbid).
    legacy_flag = await client.post(
        "/api/v1/access-keys",
        headers=headers,
        json={"label": "A2A legacy flag", "allowA2aEvents": True},
    )
    assert legacy_flag.status_code == 422

    deleted = await client.delete(
        f"/api/v1/access-keys/{body['id']}",
        headers=headers,
    )
    assert deleted.status_code == 200
    assert deleted.json() == {"ok": True}

    again = await client.delete(
        f"/api/v1/access-keys/{body['id']}",
        headers=headers,
    )
    assert again.status_code == 404
    assert again.json()["error_code"] == "NOT_FOUND"

    bare = await client.get("/api/v1/access-keys")
    assert bare.status_code == 401
