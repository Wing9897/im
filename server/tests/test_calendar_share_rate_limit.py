"""Calendar-share proxy rate limits so the UI cannot hammer IntelligenceCalendar."""

from __future__ import annotations

from server.calendar_share.rate_limit import (
    AUTH_LIMIT,
    AUTH_WINDOW_SECONDS,
    PUBLIC_EVENTS_LIMIT,
    PUBLIC_EVENTS_WINDOW_SECONDS,
    SEARCH_LIMIT,
    SEARCH_WINDOW_SECONDS,
    SUBSCRIBE_LIMIT,
    SUBSCRIBE_WINDOW_SECONDS,
    reset_calendar_share_rate_limit_for_tests,
)
from server.tests.calendar_share_fakes import login_calendar_share


def test_calendar_share_limits_match_ic_public_table():
    assert SEARCH_LIMIT == 5
    assert SEARCH_WINDOW_SECONDS == 10
    assert AUTH_LIMIT == 5
    assert AUTH_WINDOW_SECONDS == 60
    assert SUBSCRIBE_LIMIT == 5
    assert SUBSCRIBE_WINDOW_SECONDS == 10
    assert PUBLIC_EVENTS_LIMIT == 30
    assert PUBLIC_EVENTS_WINDOW_SECONDS == 60


async def test_search_rate_limit_returns_structured_429(client, fake_remote):
    reset_calendar_share_rate_limit_for_tests()
    last = None
    for _ in range(SEARCH_LIMIT + 1):
        last = await client.get("/api/v1/calendar-share/search", params={"q": "Demo"})
    assert last is not None
    assert last.status_code == 429
    body = last.json()
    assert body["error_code"] == "RATE_LIMITED"
    assert "wait" in body["message"].lower() or "too many" in body["message"].lower()
    search_calls = [call for call in fake_remote.calls if call["path"] == "/search"]
    assert len(search_calls) == SEARCH_LIMIT


async def test_subscribe_rate_limit_blocks_a_second_burst(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    reset_calendar_share_rate_limit_for_tests()
    last = None
    for _ in range(SUBSCRIBE_LIMIT + 1):
        last = await client.post(
            "/api/v1/calendar-share/subscriptions",
            json={"handle": "Alice", "slug": "Work"},
        )
    assert last is not None
    assert last.status_code == 429
    assert last.json()["error_code"] == "RATE_LIMITED"
    posts = [call for call in fake_remote.calls if call["path"] == "/me/subscriptions" and call["method"] == "POST"]
    assert len(posts) == SUBSCRIBE_LIMIT
