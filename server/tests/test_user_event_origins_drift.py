"""Drift guards for ``user_events.origin`` Python SoT vs DDL CHECK."""

from __future__ import annotations

import re

from server.db.schema_domains import calendar as calendar_ddl
from server.domain.user_event_origins import (
    ALL_USER_EVENT_ORIGINS,
    ALLOWED_USER_EVENT_ORIGINS,
    TOOL_WRITE_USER_EVENT_ORIGINS,
    USER_EVENT_ORIGIN_CHECK_SQL,
)

_ORIGIN_CHECK = re.compile(
    r"origin\s+TEXT\s+NOT\s+NULL\s+CHECK\s+\(\s*origin\s+IN\s+\(([^)]+)\)\s*\)",
    re.IGNORECASE,
)


def _ddl_origin_values() -> frozenset[str]:
    match = _ORIGIN_CHECK.search(calendar_ddl.DDL)
    assert match is not None, "user_events.origin CHECK not found in calendar DDL"
    return frozenset(re.findall(r"'([^']+)'", match.group(1)))


def test_user_event_origins_match_ddl_check() -> None:
    """Python SoT must equal the wipe-only DDL CHECK set (no silent drift)."""
    assert _ddl_origin_values() == ALLOWED_USER_EVENT_ORIGINS
    assert USER_EVENT_ORIGIN_CHECK_SQL in calendar_ddl.DDL
    assert len(ALL_USER_EVENT_ORIGINS) == len(set(ALL_USER_EVENT_ORIGINS))
    assert set(ALL_USER_EVENT_ORIGINS) == ALLOWED_USER_EVENT_ORIGINS


def test_tool_write_origins_are_ddl_subset_excluding_ics() -> None:
    """Tool writers may stamp any DB origin except ICS import provenance."""
    assert TOOL_WRITE_USER_EVENT_ORIGINS <= ALLOWED_USER_EVENT_ORIGINS
    assert "ics" not in TOOL_WRITE_USER_EVENT_ORIGINS
    assert (ALLOWED_USER_EVENT_ORIGINS - {"ics"}) == TOOL_WRITE_USER_EVENT_ORIGINS
