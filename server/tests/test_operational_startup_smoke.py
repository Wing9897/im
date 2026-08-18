"""End-to-end operational smoke against a fresh, isolated database."""

from __future__ import annotations

from httpx import ASGITransport, AsyncClient

from server.db.schema_bootstrap import CURRENT_SCHEMA_VERSION
from server.main import create_app


async def test_fresh_database_auth_and_representative_routes(tmp_path) -> None:
    db_path = tmp_path / "operational-smoke.db"
    app = create_app(
        db_path=str(db_path),
        start_collector=False,
        start_scheduler=False,
        serve_static=False,
    )

    async with app.router.lifespan_context(app):
        assert db_path.is_file()
        assert await app.state.db.fetch_value("PRAGMA user_version") == CURRENT_SCHEMA_VERSION

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://127.0.0.1") as client:
            health = await client.get("/api/v1/health")
            assert health.status_code == 200
            assert health.json()["status"] == "ok"
            assert health.json()["runtimeReady"] is True

            initial = (await client.get("/api/v1/setup/status")).json()
            assert initial == {
                "bootstrapped": False,
                "hasAdmin": False,
                "hasActiveDevice": False,
                "credentialsConfigured": False,
                "localhostAuthExempt": True,
                "resetPasswordForLocal": False,
            }

            registered = await client.post(
                "/api/v1/setup/register",
                json={"username": "admin", "password": "password1", "label": "Host"},
            )
            assert registered.status_code == 200
            host = registered.json()
            host_headers = {"Authorization": f"Bearer {host['accessToken']}"}

            secured = (await client.get("/api/v1/setup/status")).json()
            assert secured["bootstrapped"] is True
            assert secured["hasAdmin"] is True
            assert secured["hasActiveDevice"] is True
            assert secured["credentialsConfigured"] is True
            assert secured["localhostAuthExempt"] is False

            for protected_path in ("/api/v1/tasks", "/api/v1/config/settings"):
                assert (await client.get(protected_path)).status_code == 401

            representative_gets = {
                "/api/v1/tasks": list,
                "/api/v1/results/events?limit=5": dict,
                ("/api/v1/calendar/occurrences?rangeStart=2026-01-01T00:00:00Z&rangeEnd=2026-01-02T00:00:00Z"): list,
                "/api/v1/config/settings": dict,
            }
            for path, expected_type in representative_gets.items():
                response = await client.get(path, headers=host_headers)
                assert response.status_code == 200, (path, response.text)
                assert isinstance(response.json(), expected_type)

            devices = await client.get("/api/v1/setup/devices", headers=host_headers)
            assert devices.status_code == 200
            assert len(devices.json()["devices"]) == 1
            assert devices.json()["devices"][0]["current"] is True

            refreshed = await client.post(
                "/api/v1/setup/refresh",
                json={"refreshToken": host["refreshToken"]},
            )
            assert refreshed.status_code == 200
            rotated = refreshed.json()
            assert rotated["accessToken"] != host["accessToken"]
            assert rotated["refreshToken"] != host["refreshToken"]
            assert (await client.get("/api/v1/tasks", headers=host_headers)).status_code == 401
            rotated_headers = {"Authorization": f"Bearer {rotated['accessToken']}"}
            assert (await client.get("/api/v1/tasks", headers=rotated_headers)).status_code == 200

            login = await client.post(
                "/api/v1/setup/login",
                json={"username": "admin", "password": "password1", "label": "Browser"},
            )
            assert login.status_code == 200
            browser_headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}
            devices = await client.get("/api/v1/setup/devices", headers=browser_headers)
            assert devices.status_code == 200
            assert len(devices.json()["devices"]) == 2
            assert sum(device["current"] for device in devices.json()["devices"]) == 1

            logout = await client.post("/api/v1/setup/logout", headers=browser_headers)
            assert logout.status_code == 200
            assert logout.json() == {"ok": True}
            assert (await client.get("/api/v1/tasks", headers=browser_headers)).status_code == 401
            assert (await client.get("/api/v1/tasks", headers=rotated_headers)).status_code == 200
