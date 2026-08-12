"""Drift guards for timeline ``source`` Python SoT vs DDL CHECK."""

from __future__ import annotations

import re

from server.calendar.timeline_dismissals import ALLOWED_SOURCES as DISMISS_SOURCES
from server.calendar.timeline_importance import ALLOWED_SOURCES as IMPORTANCE_SOURCES
from server.db.schema_domains import calendar as calendar_ddl
from server.domain.timeline_sources import (
    ALL_TIMELINE_SOURCES,
    ALLOWED_TIMELINE_SOURCES,
    TIMELINE_SOURCE_CHECK_SQL,
)

_SOURCE_CHECK = re.compile(
    r"source\s+TEXT\s+NOT\s+NULL\s+CHECK\s+\(\s*source\s+IN\s+\(([^)]+)\)\s*\)",
    re.IGNORECASE,
)


def _ddl_timeline_source_values() -> frozenset[str]:
    matches = _SOURCE_CHECK.findall(calendar_ddl.DDL)
    assert matches, "timeline source CHECK not found in calendar DDL"
    sets = [frozenset(re.findall(r"'([^']+)'", group)) for group in matches]
    assert len(sets) >= 2, "expected CHECK on timeline_dismissals and timeline_importance"
    assert all(s == sets[0] for s in sets), "timeline source CHECK sets must match across tables"
    return sets[0]


def test_timeline_sources_match_ddl_check() -> None:
    """Python SoT must equal the wipe-only DDL CHECK set (no silent drift)."""
    assert ALLOWED_TIMELINE_SOURCES == _ddl_timeline_source_values()
    assert TIMELINE_SOURCE_CHECK_SQL in calendar_ddl.DDL
    assert len(ALL_TIMELINE_SOURCES) == len(set(ALL_TIMELINE_SOURCES))
    assert set(ALL_TIMELINE_SOURCES) == ALLOWED_TIMELINE_SOURCES


def test_dismissals_and_importance_share_timeline_source_sot() -> None:
    assert DISMISS_SOURCES == ALLOWED_TIMELINE_SOURCES
    assert IMPORTANCE_SOURCES == ALLOWED_TIMELINE_SOURCES
