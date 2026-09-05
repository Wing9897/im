"""IM vs IntelligenceCalendar: slug regex and rate-limit numbers must match.

IC is the authority. Skip when the sibling repo is not checked out.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from server.calendar_share.constants import HANDLE_MAX_LEN, SLUG_MAX_LEN
from server.calendar_share.rate_limit import (
    AUTH_LIMIT,
    AUTH_WINDOW_SECONDS,
    PUBLIC_EVENTS_LIMIT,
    PUBLIC_EVENTS_WINDOW_SECONDS,
    SEARCH_LIMIT,
    SEARCH_WINDOW_SECONDS,
    SUBSCRIBE_LIMIT,
    SUBSCRIBE_WINDOW_SECONDS,
)

IC_ROOT = Path(__file__).resolve().parents[2].parent / "IntelligenceCalendar"


pytestmark = pytest.mark.skipif(not IC_ROOT.is_dir(), reason="IntelligenceCalendar sibling repo missing")


def _source(rel: str) -> str:
    return (IC_ROOT / rel).read_text(encoding="utf-8")


def _compile_pattern(source: str, name: str) -> str:
    match = re.search(rf"{re.escape(name)}\s*=\s*re\.compile\(r([\"'])(.+?)\1\)", source)
    assert match, f"{name} not found"
    return match.group(2)


def _assign_int(source: str, name: str) -> int:
    match = re.search(rf"^{re.escape(name)}(?::\s*Final)?\s*=\s*(\d+)\s*$", source, re.M)
    assert match, f"{name} not found"
    return int(match.group(1))


def test_slug_regex_and_max_len_match_ic() -> None:
    ic = _source("app/slug.py")
    im_normalize = Path(__file__).resolve().parents[1] / "calendar_share" / "store" / "normalize.py"
    im = im_normalize.read_text(encoding="utf-8")
    assert _compile_pattern(im, "_SLUG_RE") == _compile_pattern(ic, "_SLUG_RE")
    # IM dropped its legacy read regex at stamp 7; IC's ``_LEGACY_SLUG_RE`` is IC-internal only.
    assert "_LEGACY_SLUG_RE" not in im
    assert _assign_int(ic, "SLUG_MAX_LEN") == SLUG_MAX_LEN


def test_handle_regex_and_max_len_match_ic() -> None:
    ic = _source("app/handle.py")
    im_normalize = Path(__file__).resolve().parents[1] / "calendar_share" / "store" / "normalize.py"
    im = im_normalize.read_text(encoding="utf-8")
    assert _compile_pattern(im, "_HANDLE_RE") == _compile_pattern(ic, "_HANDLE_RE")
    assert _assign_int(ic, "HANDLE_MAX_LEN") == HANDLE_MAX_LEN


def test_rate_limit_numbers_match_ic() -> None:
    ic = _source("app/config.py")
    assert _assign_int(ic, "RATE_LIMIT_SEARCH_LIMIT") == SEARCH_LIMIT
    assert float(_assign_int(ic, "RATE_LIMIT_SEARCH_WINDOW_SECONDS")) == SEARCH_WINDOW_SECONDS
    assert _assign_int(ic, "RATE_LIMIT_AUTH_LIMIT") == AUTH_LIMIT
    assert float(_assign_int(ic, "RATE_LIMIT_AUTH_WINDOW_SECONDS")) == AUTH_WINDOW_SECONDS
    assert _assign_int(ic, "RATE_LIMIT_SUBSCRIBE_LIMIT") == SUBSCRIBE_LIMIT
    assert float(_assign_int(ic, "RATE_LIMIT_SUBSCRIBE_WINDOW_SECONDS")) == SUBSCRIBE_WINDOW_SECONDS
    assert _assign_int(ic, "RATE_LIMIT_PUBLIC_EVENTS_LIMIT") == PUBLIC_EVENTS_LIMIT
    assert float(_assign_int(ic, "RATE_LIMIT_PUBLIC_EVENTS_WINDOW_SECONDS")) == PUBLIC_EVENTS_WINDOW_SECONDS


def _pydantic_field_names(source: str, class_name: str) -> set[str]:
    match = re.search(
        rf"^class {re.escape(class_name)}\([^)]*\):(.*?)(?=^class |\Z)",
        source,
        re.M | re.S,
    )
    assert match, f"{class_name} not found"
    names: set[str] = set()
    for raw in match.group(1).splitlines():
        line = raw.split("#", 1)[0].rstrip()
        field = re.match(r"^    ([A-Za-z_][A-Za-z0-9]*)\s*:", line)
        if field:
            names.add(field.group(1))
    return names


def test_publish_snapshot_fields_match_ic_event_in_and_put_body() -> None:
    """IM EventIn / SeriesIn / PUT snapshot keys must stay inside IC schemas."""
    from server.calendar_share.publish_snapshot import snapshot_remote_events, snapshot_remote_series

    ic = _source("app/schemas.py")
    ic_event = _pydantic_field_names(ic, "EventIn")
    ic_series = _pydantic_field_names(ic, "SeriesIn")
    ic_snapshot = _pydantic_field_names(ic, "CalendarSnapshotBody") | _pydantic_field_names(
        ic, "CalendarVisibilityMixin"
    )
    ic_snapshot.discard("resolved_visibility")

    events = snapshot_remote_events(
        [
            {
                "id": "e1",
                "source": "user",
                "title": "Standup",
                "startTime": "2026-08-01T09:00:00Z",
                "endTime": "2026-08-01T09:30:00Z",
                "location": "HQ",
                "body": "Notes",
                "isAllDay": False,
                "dismissed": False,
            }
        ]
    )
    assert events
    assert set(events[0]) == ic_event
    for required in ("uid", "start", "end"):
        assert events[0][required]

    series = snapshot_remote_series(
        [
            {
                "id": "s1",
                "name": "Weekly",
                "rrule": "FREQ=WEEKLY;BYDAY=MO",
                "event_start_local": "2026-08-03T09:00:00Z",
                "event_end_local": "2026-08-03T09:30:00Z",
                "is_active": 1,
                "event_is_all_day": 0,
                "event_location": "Room A",
                "event_description": "Sync",
                "event_timezone": "UTC",
                "event_timezone_ical": "",
                "event_exdates_json": "[]",
                "event_rdates_json": "[]",
            }
        ]
    )
    assert series
    assert set(series[0]) == ic_series
    for required in ("uid", "rrule", "dtstart"):
        assert series[0][required]

    put_src = (
        Path(__file__).resolve().parents[1].joinpath("calendar_share", "publish_remote.py").read_text(encoding="utf-8")
    )
    put_match = re.search(r"async def put_full_snapshot.*?body = \{([^}]+)\}", put_src, re.S)
    assert put_match, "put_full_snapshot body not found"
    put_keys = set(re.findall(r'"(\w+)"\s*:', put_match.group(1)))
    assert put_keys == ic_snapshot


def test_listing_canonical_values_match_ic() -> None:
    ic = _source("app/visibility.py")
    im = Path(__file__).resolve().parents[1].joinpath("calendar_share", "constants.py").read_text(encoding="utf-8")
    assert 'LISTING_PRIVATE_GROUP: Final = "private_group"' in ic
    assert 'LISTING_PUBLIC: Final = "public"' in ic
    assert 'LISTING_PUBLIC_BUSY: Final = "public_busy"' in ic
    assert "LEGACY_LISTING" not in ic
    assert "LEGACY_LISTING" not in im
    assert 'GRANT_VISIBILITY_VALUES: Final[tuple[str, ...]] = ("busy", "details")' in ic
    assert 'VISIBILITY_GRANT: Final[tuple[GrantVisibility, ...]] = ("busy", "details")' in im
