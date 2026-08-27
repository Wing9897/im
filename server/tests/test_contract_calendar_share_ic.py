"""IM vs IntelligenceCalendar: slug regex and rate-limit numbers must match.

IC is the authority. Skip when the sibling repo is not checked out.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from server.calendar_share.constants import LEGACY_LISTING_VISIBILITY, SLUG_MAX_LEN
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
    im_store = Path(__file__).resolve().parents[1] / "calendar_share" / "store.py"
    im = im_store.read_text(encoding="utf-8")
    assert _compile_pattern(im, "_SLUG_RE") == _compile_pattern(ic, "_SLUG_RE")
    assert _compile_pattern(im, "_LEGACY_SLUG_RE") == _compile_pattern(ic, "_LEGACY_SLUG_RE")
    assert _assign_int(ic, "SLUG_MAX_LEN") == SLUG_MAX_LEN


def test_rate_limit_numbers_match_ic() -> None:
    ic = _source("app/config.py")
    assert SEARCH_LIMIT == _assign_int(ic, "RATE_LIMIT_SEARCH_LIMIT")
    assert SEARCH_WINDOW_SECONDS == float(_assign_int(ic, "RATE_LIMIT_SEARCH_WINDOW_SECONDS"))
    assert AUTH_LIMIT == _assign_int(ic, "RATE_LIMIT_AUTH_LIMIT")
    assert AUTH_WINDOW_SECONDS == float(_assign_int(ic, "RATE_LIMIT_AUTH_WINDOW_SECONDS"))
    assert SUBSCRIBE_LIMIT == _assign_int(ic, "RATE_LIMIT_SUBSCRIBE_LIMIT")
    assert SUBSCRIBE_WINDOW_SECONDS == float(_assign_int(ic, "RATE_LIMIT_SUBSCRIBE_WINDOW_SECONDS"))
    assert PUBLIC_EVENTS_LIMIT == _assign_int(ic, "RATE_LIMIT_PUBLIC_EVENTS_LIMIT")
    assert PUBLIC_EVENTS_WINDOW_SECONDS == float(_assign_int(ic, "RATE_LIMIT_PUBLIC_EVENTS_WINDOW_SECONDS"))


def test_listing_legacy_map_matches_ic() -> None:
    ic = _source("app/visibility.py")
    assert 'LISTING_PRIVATE_GROUP: Final = "private_group"' in ic
    assert 'LISTING_PUBLIC: Final = "public"' in ic
    assert 'LISTING_PUBLIC_BUSY: Final = "public_busy"' in ic
    assert '"off": LISTING_PRIVATE_GROUP' in ic
    assert '"details": LISTING_PUBLIC' in ic
    assert '"busy": LISTING_PUBLIC_BUSY' in ic
    assert dict(LEGACY_LISTING_VISIBILITY) == {
        "off": "private_group",
        "details": "public",
        "busy": "public_busy",
    }
