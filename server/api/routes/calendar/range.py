"""Shared ISO range-query parsing for calendar HTTP routes."""

from __future__ import annotations

from datetime import datetime

from server.errors import VALIDATION_ERROR, http_error
from server.time_iso import parse_iso


def parse_range_param(value: str, name: str, *, end_of_day: bool = False) -> datetime:
    parsed = parse_iso(value, end_of_day=end_of_day)
    if parsed is None:
        raise http_error(422, f"Invalid {name}: {value}", error_code=VALIDATION_ERROR)
    return parsed
