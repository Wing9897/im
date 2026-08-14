"""Drift guards for ``user_events.kind`` / ``direction`` Python SoT vs DDL CHECK."""

from __future__ import annotations

import re

from server.db.schema_domains import calendar as calendar_ddl
from server.domain.user_event_directions import (
    ALL_USER_EVENT_DIRECTIONS,
    ALLOWED_USER_EVENT_DIRECTIONS,
    USER_EVENT_DIRECTION_CHECK_SQL,
)
from server.domain.user_event_kinds import (
    ALL_USER_EVENT_KINDS,
    ALLOWED_USER_EVENT_KINDS,
    USER_EVENT_KIND_CHECK_SQL,
)

_KIND_CHECK = re.compile(
    r"kind\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'normal'\s+"
    r"CHECK\s+\(\s*kind\s+IN\s+\(([^)]+)\)\s*\)",
    re.IGNORECASE,
)
_DIRECTION_CHECK = re.compile(
    r"direction\s+TEXT\s+DEFAULT\s+NULL\s+"
    r"CHECK\s+\(\s*direction\s+IS\s+NULL\s+OR\s+direction\s+IN\s+\(([^)]+)\)\s*\)",
    re.IGNORECASE,
)


def test_user_event_kinds_match_ddl_check() -> None:
    match = _KIND_CHECK.search(calendar_ddl.DDL)
    assert match is not None, "user_events.kind CHECK not found in calendar DDL"
    ddl_values = frozenset(re.findall(r"'([^']+)'", match.group(1)))
    assert ddl_values == ALLOWED_USER_EVENT_KINDS
    assert USER_EVENT_KIND_CHECK_SQL in calendar_ddl.DDL
    assert set(ALL_USER_EVENT_KINDS) == ALLOWED_USER_EVENT_KINDS


def test_user_event_directions_match_ddl_check() -> None:
    match = _DIRECTION_CHECK.search(calendar_ddl.DDL)
    assert match is not None, "user_events.direction CHECK not found in calendar DDL"
    ddl_values = frozenset(re.findall(r"'([^']+)'", match.group(1)))
    assert ddl_values == ALLOWED_USER_EVENT_DIRECTIONS
    assert USER_EVENT_DIRECTION_CHECK_SQL in calendar_ddl.DDL
    assert set(ALL_USER_EVENT_DIRECTIONS) == ALLOWED_USER_EVENT_DIRECTIONS
