"""Frozen hash vectors shared with IntelligenceCalendar (copied, not a package).

Keep fixtures and expected digests identical to
``IntelligenceCalendar/tests/test_hash_contract.py``.
"""

from server.calendar_share.snapshot import events_content_hash, grants_content_hash

# Copied freeze vector — do not drift independently of IntelligenceCalendar.
EVENT = {
    "uid": "ev-standup",
    "start": "2026-08-15T09:00:00Z",
    "end": "2026-08-15T10:00:00Z",
    "title": "Standup",
    "location": "Room A",
    "description": "Daily sync",
    "allDay": False,
}
SERIES = {
    "uid": "ser-weekly",
    "name": "Weekly",
    "rrule": "FREQ=WEEKLY;BYDAY=MO",
    "dtstart": "2026-08-03T09:00:00Z",
    "dtend": "2026-08-03T10:00:00Z",
    "isAllDay": False,
    "location": "",
    "description": "",
    "timezone": "Asia/Hong_Kong",
    "timezoneIcal": "",
    "exdatesJson": "[]",
    "rdatesJson": "[]",
    "isActive": True,
}
GRANTS = [
    {"handle": "Alice", "visibility": "busy"},
    {"handle": "Carol", "visibility": "details"},
]

EVENTS_HASH = "e12db269a330382645ac7b902a82b00ff8c580adb42909b46d022ca9c5ce74e2"
GRANTS_HASH = "d1775c4c9741267a9465379c15d7f0d39823612be3510dc66e536ed1d6462a07"


def test_events_and_series_hash_matches_frozen_vector():
    assert events_content_hash([EVENT], [SERIES]) == EVENTS_HASH


def test_grants_hash_matches_frozen_vector():
    assert grants_content_hash(GRANTS) == GRANTS_HASH
