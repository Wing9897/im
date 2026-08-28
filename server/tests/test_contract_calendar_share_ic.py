"""IM vs IntelligenceCalendar: slug regex and rate-limit numbers must match.

IC is the authority. Skip when the sibling repo is not checked out.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from server.calendar_share.constants import SLUG_MAX_LEN
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
    assert _compile_pattern(im, "_LEGACY_SLUG_RE") == _compile_pattern(ic, "_LEGACY_SLUG_RE")
    assert _assign_int(ic, "SLUG_MAX_LEN") == SLUG_MAX_LEN


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
