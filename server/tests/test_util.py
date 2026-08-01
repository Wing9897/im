"""Tests for shared helpers in server/util.py."""

from __future__ import annotations

import pytest

from server.util import is_openai_json_mode_enabled, parse_bool, parse_mqtt_url


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("1", True),
        ("true", True),
        ("YES", True),
        ("on", True),
        ("0", False),
        ("false", False),
        ("off", False),
        ("maybe", False),
    ],
)
def test_parse_bool(raw: str, expected: bool) -> None:
    assert parse_bool(raw) is expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("true", True),
        ("enabled", True),
        ("", False),
        ("disabled", False),
        ("off", False),
        ("false", False),
        ("0", False),
        ("FALSE", False),
    ],
)
def test_is_openai_json_mode_enabled(raw: str, expected: bool) -> None:
    assert is_openai_json_mode_enabled(raw) is expected


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("mqtt://broker.example.com:8883", ("broker.example.com", 8883)),
        ("mqtt://broker.example.com", ("broker.example.com", 1883)),
        ("tcp://10.0.0.5:1884", ("10.0.0.5", 1884)),
        ("broker.example.com:1885", ("broker.example.com", 1885)),
        ("broker.example.com", ("broker.example.com", 1883)),
        ("  mqtt://spaced.example.com  ", ("spaced.example.com", 1883)),
        ("", ("", 1883)),
        ("mqtt://host:notaport", ("", 1883)),
    ],
)
def test_parse_mqtt_url(url: str, expected: tuple[str, int]) -> None:
    assert parse_mqtt_url(url) == expected
