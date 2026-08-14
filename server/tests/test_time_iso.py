"""Shared ISO helpers."""

from datetime import UTC, datetime

from server.time_iso import parse_iso, to_iso_z


def test_parse_iso_z_and_offset() -> None:
    assert parse_iso("2026-07-20T00:00:00Z") == datetime(2026, 7, 20, 0, 0, tzinfo=UTC)
    assert parse_iso("2026-07-20T00:00:00+08:00") == datetime(2026, 7, 19, 16, 0, tzinfo=UTC)


def test_parse_iso_date_only_end_of_day() -> None:
    start = parse_iso("2026-07-26")
    end = parse_iso("2026-07-26", end_of_day=True)
    assert start == datetime(2026, 7, 26, 0, 0, 0, tzinfo=UTC)
    assert end == datetime(2026, 7, 26, 23, 59, 59, tzinfo=UTC)


def test_to_iso_z() -> None:
    dt = datetime(2026, 7, 20, 8, 0, tzinfo=UTC)
    assert to_iso_z(dt) == "2026-07-20T08:00:00Z"
