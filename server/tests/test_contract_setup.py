"""Contract tests for setup / admin password / device session APIs."""

from __future__ import annotations

from server.access_keys import create_access_key, seed_access_key
from server.config import get_config_bool, set_configs


def _assert_status_shape(body: dict) -> None:
    assert set(body) >= {
        "bootstrapped",
        "hasAdmin",
        "hasActiveDevice",
        "credentialsConfigured",
        "localhostAuthExempt",
        "resetPasswordForLocal",
    }


async def _register(client, *, username="admin", password="password1", label="Host PC"):
    return await client.post(
        "/api/v1/setup/register",
        json={"username": username, "password": password, "label": label},
    )


async def test_setup_status_public(client):
    resp = await client.get("/api/v1/setup/status")
    assert resp.status_code == 200
    body = resp.json()
    _assert_status_shape(body)
    assert body["bootstrapped"] is False
    assert body["hasAdmin"] is False
    assert body["hasActiveDevice"] is False
    assert body["credentialsConfigured"] is False
    assert body["localhostAuthExempt"] is True
    assert body["resetPasswordForLocal"] is False


async def test_register_login_refresh_logout_flow(client, remote_client):
    status = await client.get("/api/v1/setup/status")
    assert status.json()["bootstrapped"] is False

    reg = await _register(client, label="Host PC")
    assert reg.status_code == 200
    host = reg.json()
    assert host["accessToken"]
    assert host["refreshToken"]
    assert host["device"]["label"] == "Host PC"
    assert host["accessExpiresAt"]
    assert host["refreshExpiresAt"]

    status2 = await client.get("/api/v1/setup/status")
    body2 = status2.json()
    assert body2["bootstrapped"] is True
    assert body2["hasAdmin"] is True
    assert body2["hasActiveDevice"] is True
    assert body2["credentialsConfigured"] is True
    assert body2["localhostAuthExempt"] is False

    # After register, loopback without token is rejected.
    bare = await client.get("/api/v1/tasks")
    assert bare.status_code == 401

    host_headers = {"Authorization": f"Bearer {host['accessToken']}"}
    ok = await client.get("/api/v1/tasks", headers=host_headers)
    assert ok.status_code == 200

    # Remote login with same admin credentials → second device.
    login = await remote_client.post(
        "/api/v1/setup/login",
        json={"username": "admin", "password": "password1", "label": "Phone"},
    )
    assert login.status_code == 200
    phone = login.json()
    assert phone["device"]["label"] == "Phone"

    phone_headers = {"Authorization": f"Bearer {phone['accessToken']}"}
    remote_ok = await remote_client.get("/api/v1/tasks", headers=phone_headers)
    assert remote_ok.status_code == 200

    # Wrong password rejected.
    bad = await remote_client.post(
        "/api/v1/setup/login",
        json={"username": "admin", "password": "wrong-password"},
    )
    assert bad.status_code == 401
    assert bad.json()["error_code"] == "INVALID_CREDENTIALS"

    # Refresh rotates tokens; old access fails.
    refreshed = await remote_client.post(
        "/api/v1/setup/refresh",
        json={"refreshToken": phone["refreshToken"]},
    )
    assert refreshed.status_code == 200
    new_tokens = refreshed.json()
    assert new_tokens["accessToken"] != phone["accessToken"]
    assert new_tokens["refreshToken"] != phone["refreshToken"]

    stale = await remote_client.get("/api/v1/tasks", headers=phone_headers)
    assert stale.status_code == 401
    fresh_headers = {"Authorization": f"Bearer {new_tokens['accessToken']}"}
    assert (await remote_client.get("/api/v1/tasks", headers=fresh_headers)).status_code == 200

    # Old refresh is invalid after rotation.
    stale_refresh = await remote_client.post(
        "/api/v1/setup/refresh",
        json={"refreshToken": phone["refreshToken"]},
    )
    assert stale_refresh.status_code == 401
    assert stale_refresh.json()["error_code"] == "INVALID_REFRESH_TOKEN"

    devices = await client.get("/api/v1/setup/devices", headers=host_headers)
    assert devices.status_code == 200
    listed = devices.json()["devices"]
    assert len(listed) == 2
    assert sum(1 for d in listed if d["current"]) == 1

    logout = await remote_client.post("/api/v1/setup/logout", headers=fresh_headers)
    assert logout.status_code == 200
    assert logout.json()["ok"] is True
    assert (await remote_client.get("/api/v1/tasks", headers=fresh_headers)).status_code == 401

    # Second register rejected while admin exists.
    again = await _register(client, label="Nope")
    assert again.status_code == 409
    assert again.json()["error_code"] == "ADMIN_EXISTS"


async def test_revoke_all_keeps_admin_login_recovery(client, remote_client):
    reg = await _register(client, label="Host")
    host = reg.json()
    host_headers = {"Authorization": f"Bearer {host['accessToken']}"}

    phone = (
        await remote_client.post(
            "/api/v1/setup/login",
            json={"username": "admin", "password": "password1", "label": "Phone"},
        )
    ).json()

    assert (
        await client.delete(
            f"/api/v1/setup/devices/{phone['device']['id']}",
            headers=host_headers,
        )
    ).status_code == 200
    assert (
        await client.delete(
            f"/api/v1/setup/devices/{host['device']['id']}",
            headers=host_headers,
        )
    ).status_code == 200

    status = (await client.get("/api/v1/setup/status")).json()
    assert status["bootstrapped"] is True
    assert status["hasAdmin"] is True
    assert status["hasActiveDevice"] is False
    assert status["localhostAuthExempt"] is False

    bare = await client.get("/api/v1/tasks")
    assert bare.status_code == 401

    # Recovery is password login, not re-register.
    again = await _register(client, label="Recovered")
    assert again.status_code == 409
    assert again.json()["error_code"] == "ADMIN_EXISTS"

    login = await client.post(
        "/api/v1/setup/login",
        json={"username": "admin", "password": "password1", "label": "Recovered"},
    )
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}
    assert (await client.get("/api/v1/tasks", headers=headers)).status_code == 200
    status2 = (await client.get("/api/v1/setup/status")).json()
    assert status2["hasActiveDevice"] is True
    assert status2["localhostAuthExempt"] is False


async def test_register_rejects_remote(remote_client):
    resp = await remote_client.post(
        "/api/v1/setup/register",
        json={"username": "admin", "password": "password1", "label": "Remote"},
    )
    assert resp.status_code == 403
    assert resp.json()["error_code"] == "FORBIDDEN"


async def test_login_rejects_before_register(client, remote_client):
    loopback = await client.post(
        "/api/v1/setup/login",
        json={"username": "admin", "password": "password1"},
    )
    assert loopback.status_code == 409
    assert loopback.json()["error_code"] == "NOT_BOOTSTRAPPED"

    remote = await remote_client.post(
        "/api/v1/setup/login",
        json={"username": "admin", "password": "password1"},
    )
    assert remote.status_code == 409
    assert remote.json()["error_code"] == "NOT_BOOTSTRAPPED"


async def test_change_password_requires_current(client):
    reg = await _register(client)
    headers = {"Authorization": f"Bearer {reg.json()['accessToken']}"}

    bad = await client.post(
        "/api/v1/setup/change-password",
        headers=headers,
        json={"currentPassword": "wrong-password", "newPassword": "password2"},
    )
    assert bad.status_code == 401
    assert bad.json()["error_code"] == "INVALID_CREDENTIALS"

    ok = await client.post(
        "/api/v1/setup/change-password",
        headers=headers,
        json={"currentPassword": "password1", "newPassword": "password2"},
    )
    assert ok.status_code == 200
    assert ok.json() == {"ok": True}

    # Old password no longer works; new password does.
    stale = await client.post(
        "/api/v1/setup/login",
        json={"username": "admin", "password": "password1"},
    )
    assert stale.status_code == 401
    fresh = await client.post(
        "/api/v1/setup/login",
        json={"username": "admin", "password": "password2", "label": "After change"},
    )
    assert fresh.status_code == 200


async def test_reset_password_requires_file_arm(client, remote_client, tmp_path, monkeypatch):
    from server.constants import DATA_DIR_ENV

    monkeypatch.setenv(DATA_DIR_ENV, str(tmp_path))
    await _register(client)

    remote = await remote_client.post(
        "/api/v1/setup/reset-password",
        json={"username": "admin", "newPassword": "password9"},
    )
    assert remote.status_code == 403
    assert remote.json()["error_code"] == "FORBIDDEN"

    # Loopback still forbidden until connection.json arms the rescue flag.
    unarmed = await client.post(
        "/api/v1/setup/reset-password",
        json={"username": "admin", "newPassword": "password9"},
    )
    assert unarmed.status_code == 403
    assert unarmed.json()["error_code"] == "FORBIDDEN"
    assert (await client.get("/api/v1/setup/status")).json()["resetPasswordForLocal"] is False

    (tmp_path / "connection.json").write_text(
        '{"mode":"host","resetPasswordForLocal":true}\n',
        encoding="utf-8",
    )
    assert (await client.get("/api/v1/setup/status")).json()["resetPasswordForLocal"] is True

    ok = await client.post(
        "/api/v1/setup/reset-password",
        json={"username": "admin", "newPassword": "password9"},
    )
    assert ok.status_code == 200
    assert ok.json() == {"ok": True}
    # One-shot: flag cleared after success.
    assert (await client.get("/api/v1/setup/status")).json()["resetPasswordForLocal"] is False

    login = await remote_client.post(
        "/api/v1/setup/login",
        json={"username": "admin", "password": "password9", "label": "After reset"},
    )
    assert login.status_code == 200

    again = await client.post(
        "/api/v1/setup/reset-password",
        json={"username": "admin", "newPassword": "password8"},
    )
    assert again.status_code == 403


async def test_register_sets_localhost_auth_exempt_false(client, app):
    """New admin register must disable loopback auth exemption (product default)."""
    assert await get_config_bool(app.state.db, "localhost_auth_exempt") is True
    reg = await _register(client, label="Host")
    assert reg.status_code == 200
    assert await get_config_bool(app.state.db, "localhost_auth_exempt") is False
    assert await get_config_bool(app.state.db, "setup_complete") is True
    status = await client.get("/api/v1/setup/status")
    body = status.json()
    assert body["bootstrapped"] is True
    assert body["hasAdmin"] is True
    assert body["localhostAuthExempt"] is False
    bare = await client.get("/api/v1/tasks")
    assert bare.status_code == 401
    headers = {"Authorization": f"Bearer {reg.json()['accessToken']}"}
    assert (await client.get("/api/v1/tasks", headers=headers)).status_code == 200


async def test_api_key_still_works_after_register(client, remote_client, app):
    reg = await _register(client, label="Host")
    assert reg.status_code == 200

    created = await create_access_key(app.state.db, "Webhook")
    api_key = created["key"]
    headers = {"Authorization": f"Bearer {api_key}"}

    remote_ok = await remote_client.get("/api/v1/tasks", headers=headers)
    assert remote_ok.status_code == 200

    write = await remote_client.post(
        "/api/v1/tasks",
        headers=headers,
        json={"name": "via key", "promptTemplate": "x"},
    )
    assert write.status_code == 201


async def test_revoke_other_device(client, remote_client):
    reg = await _register(client, label="Host")
    host_headers = {"Authorization": f"Bearer {reg.json()['accessToken']}"}
    phone = (
        await remote_client.post(
            "/api/v1/setup/login",
            json={"username": "admin", "password": "password1", "label": "Phone"},
        )
    ).json()
    phone_id = phone["device"]["id"]
    phone_headers = {"Authorization": f"Bearer {phone['accessToken']}"}

    revoked = await client.delete(f"/api/v1/setup/devices/{phone_id}", headers=host_headers)
    assert revoked.status_code == 200
    assert (await remote_client.get("/api/v1/tasks", headers=phone_headers)).status_code == 401


async def test_loopback_exempt_disabled_without_register_still_needs_key(client, app):
    await set_configs(app.state.db, {"localhost_auth_exempt": "false"})
    await seed_access_key(app.state.db, "k", label="Loopback")
    assert await get_config_bool(app.state.db, "localhost_auth_exempt") is False
    bare = await client.get("/api/v1/tasks")
    assert bare.status_code == 401
    ok = await client.get("/api/v1/tasks", headers={"Authorization": "Bearer k"})
    assert ok.status_code == 200
