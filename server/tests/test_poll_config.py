"""Poll interval normalization tests."""

from __future__ import annotations

from server.collector.poll_config import (
    DEFAULT_POLL_INTERVAL,
    MAX_POLL_INTERVAL,
    MIN_POLL_INTERVAL,
    clamp_poll_interval,
)


def test_clamp_poll_interval_bounds():
    assert clamp_poll_interval(10) == MIN_POLL_INTERVAL
    assert clamp_poll_interval(999999) == MAX_POLL_INTERVAL
    assert clamp_poll_interval(300) == DEFAULT_POLL_INTERVAL


def test_poll_interval_contract_matches_frontend():
    """Keep in sync with web/src/utils/configValidation.ts MIN/MAX_POLL_INTERVAL_SECONDS."""
    assert MIN_POLL_INTERVAL == 60
    assert MAX_POLL_INTERVAL == 86400
    assert DEFAULT_POLL_INTERVAL == 300
