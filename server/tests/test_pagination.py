"""Unit tests for shared offset pagination helpers."""

from __future__ import annotations

from server.queries.pagination import (
    MAX_PAGE_LIMIT,
    clamp_offset_limit,
    offset_page_has_more,
)


def test_clamp_offset_limit_bounds_and_floors() -> None:
    assert clamp_offset_limit(50, 0) == (50, 0)
    assert clamp_offset_limit(0, -10) == (1, 0)
    assert clamp_offset_limit(MAX_PAGE_LIMIT + 50, 5) == (MAX_PAGE_LIMIT, 5)
    assert clamp_offset_limit(-3, 2) == (1, 2)


def test_offset_page_has_more() -> None:
    assert offset_page_has_more(0, 50, 100) is True
    assert offset_page_has_more(50, 50, 100) is False
    assert offset_page_has_more(0, 0, 0) is False
    assert offset_page_has_more(90, 10, 100) is False
