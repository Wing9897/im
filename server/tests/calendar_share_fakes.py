"""Shared FakeRemote + login helpers for calendar-share proxy tests."""

from __future__ import annotations

from typing import Any

import pytest

DEFAULT_URL = "http://127.0.0.1:8787"

WEEKLY_SERIES = {
    "uid": "series-weekly",
    "name": "Standup",
    "rrule": "FREQ=WEEKLY;BYDAY=MO",
    "dtstart": "2026-08-03T09:00:00Z",
    "dtend": "2026-08-03T09:30:00Z",
    "isAllDay": False,
    "location": "Room A",
    "description": "Weekly sync",
    "timezone": "UTC",
    "isActive": True,
    "handle": "Alice",
    "slug": "Work",
}


class FakeRemote:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.login_status = 200
        self.login_payload: Any = {"accessToken": "acc-1", "refreshToken": "ref-1"}
        self.refresh_status = 200
        self.refresh_payload: Any = {"accessToken": "acc-2", "refreshToken": "ref-2"}
        self.logout_status = 204
        self.put_calendar_status = 200
        self.delete_calendar_status = 200
        self.patch_changes_status = 200
        self.put_grants_status = 200
        self.put_timezone_status = 200
        self.post_sub_status = 200
        self.post_sub_payload: Any = {"handle": "Alice", "slug": "Work"}
        self.get_sub_status = 200
        self.delete_sub_status = 200
        self.remote_subs: list[dict[str, str]] = []
        self.search_status = 200
        self.search_payload: Any = {
            "items": [{"handle": "DemoPub", "slug": "Open", "visibility": "details"}],
        }
        self.events_status = 200
        self.events_payload: Any = {
            "calendars": [{"handle": "Alice", "slug": "Work", "visibility": "busy", "timezone": ""}],
            "events": [
                {
                    "uid": "evt-1",
                    "start": "2026-08-01T09:00:00Z",
                    "end": "2026-08-01T10:00:00Z",
                    "title": "Busy",
                    "handle": "Alice",
                    "slug": "Work",
                    "allDay": False,
                }
            ],
            "series": [],
        }
        self.fail_first_authorized = False
        self._authorized_hits = 0
        self.expired_access_tokens: set[str] = set()
        self.single_use_refresh = False
        self._consumed_refresh: str | None = None

    async def __call__(
        self,
        *,
        base_url: str,
        method: str,
        path: str,
        json_body: Any | None = None,
        query: dict[str, str] | None = None,
        access_token: str | None = None,
        refresh_token: str | None = None,
    ) -> tuple[int, Any]:
        self.calls.append(
            {
                "base_url": base_url,
                "method": method,
                "path": path,
                "json_body": json_body,
                "query": query,
                "access_token": access_token,
                "refresh_token": refresh_token,
            }
        )
        if path == "/auth/login":
            return self.login_status, self.login_payload
        if path == "/auth/refresh":
            token = ""
            if isinstance(json_body, dict):
                token = str(json_body.get("refreshToken") or json_body.get("refresh") or "").strip()
            if not token:
                token = str(refresh_token or "").strip()
            if self.single_use_refresh and self._consumed_refresh is not None and token == self._consumed_refresh:
                return 401, {"message": "refresh already used"}
            if self.single_use_refresh and self.refresh_status < 400:
                self._consumed_refresh = token
            return self.refresh_status, self.refresh_payload
        if path == "/auth/logout":
            return self.logout_status, None
        if access_token and access_token in self.expired_access_tokens:
            return 401, {"message": "expired"}
        if path == "/search":
            return self.search_status, self.search_payload
        if path == "/me/timezone":
            return self.put_timezone_status, {"timezone": (json_body or {}).get("timezone")}
        if path == "/me/subscriptions":
            if method == "GET":
                return self.get_sub_status, {"items": list(self.remote_subs)}
            if method == "POST":
                if self.post_sub_status < 400:
                    body = json_body if isinstance(json_body, dict) else {}
                    item = {
                        "handle": str(body.get("handle") or ""),
                        "slug": str(body.get("slug") or ""),
                    }
                    if item["handle"] and item["slug"] and item not in self.remote_subs:
                        self.remote_subs.append(item)
                return self.post_sub_status, self.post_sub_payload
            if method == "DELETE":
                handle = str((query or {}).get("handle") or "")
                slug = str((query or {}).get("slug") or "")
                if self.delete_sub_status < 400:
                    self.remote_subs = [
                        row for row in self.remote_subs if not (row["handle"] == handle and row["slug"] == slug)
                    ]
                return self.delete_sub_status, {"handle": handle, "slug": slug}
        if path == "/me/subscriptions/events":
            if not self.remote_subs:
                return self.events_status, {"calendars": [], "events": [], "series": []}
            return self.events_status, self.events_payload
        if path.endswith("/grants"):
            return self.put_grants_status, {"ok": True}
        if path.endswith("/changes"):
            if self.fail_first_authorized and self._authorized_hits == 0 and access_token == "acc-1":
                self._authorized_hits += 1
                return 401, {"message": "expired"}
            return self.patch_changes_status, {"contentHash": "srv-hash-2", "ok": True}
        if path.startswith("/me/calendars/"):
            if method == "DELETE":
                return self.delete_calendar_status, {"deleted": self.delete_calendar_status < 400}
            if self.fail_first_authorized and self._authorized_hits == 0 and access_token == "acc-1":
                self._authorized_hits += 1
                return 401, {"message": "expired"}
            return self.put_calendar_status, {"contentHash": "srv-hash-1", "ok": True}
        return 404, {"message": "not found"}


@pytest.fixture
def fake_remote(monkeypatch) -> FakeRemote:
    remote = FakeRemote()
    monkeypatch.setattr("server.calendar_share.remote.calendar_share_request", remote)
    return remote


async def login_calendar_share(client, fake_remote: FakeRemote) -> None:
    resp = await client.post(
        "/api/v1/calendar-share/session",
        json={"baseUrl": DEFAULT_URL, "handle": "Wing", "password": "secret"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["connected"] is True
    assert resp.json()["handle"] == "Wing"
    assert fake_remote.calls[0]["path"] == "/auth/login"
    assert fake_remote.calls[0]["json_body"] == {"handle": "Wing", "password": "secret"}


async def subscribe_calendar_share(client, path: str = "Alice/Work") -> None:
    added = await client.post("/api/v1/calendar-share/subscriptions", json={"path": path})
    assert added.status_code == 200, added.text
