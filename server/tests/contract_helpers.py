"""Shared helpers for the per-domain contract tests (test_contract_*.py).

Contract invariant: response keys ⊇ frontend-read keys, per route. Key sets
are transcribed from the frontend usage contract ("Fields
ACTUALLY READ" lists). Extra keys are allowed; missing keys fail.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any


def assert_keys(obj: dict[str, Any], required: Iterable[str], where: str) -> None:
    missing = set(required) - set(obj.keys())
    assert not missing, f"{where}: missing contract keys {sorted(missing)}"


MESSAGE_KEYS = [
    "id",
    "sourceId",
    "platform",
    "platformId",
    "channelName",
    "senderId",
    "senderName",
    "content",
    "timestamp",
]
