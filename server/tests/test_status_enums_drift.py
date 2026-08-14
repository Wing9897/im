"""Drift guards for status-column Python SoT vs DDL CHECK.

Covers ``analysis_batches.status``, ``sources.status``, ``items.status``, and
``action_trigger_history.status``.
"""

from __future__ import annotations

import re

from server.db.schema_domains import actions as actions_ddl
from server.db.schema_domains import items as items_ddl
from server.db.schema_domains import sources as sources_ddl
from server.db.schema_domains import tasks as tasks_ddl
from server.domain.action_statuses import (
    ACTION_TRIGGER_STATUS_CHECK_SQL,
    ALL_ACTION_TRIGGER_STATUSES,
    ALLOWED_ACTION_TRIGGER_STATUSES,
)
from server.domain.batch_statuses import (
    ALL_BATCH_STATUSES,
    ALLOWED_BATCH_STATUSES,
    BATCH_STATUS_CHECK_SQL,
)
from server.domain.item_statuses import (
    ALL_ITEM_STATUSES,
    ALLOWED_ITEM_STATUSES,
    ITEM_STATUS_CHECK_SQL,
)
from server.domain.source_statuses import (
    ALL_SOURCE_STATUSES,
    ALLOWED_SOURCE_STATUSES,
    SOURCE_STATUS_CHECK_SQL,
)


def _check_values(ddl: str, pattern: str, label: str) -> frozenset[str]:
    match = re.search(pattern, ddl, re.IGNORECASE)
    assert match is not None, f"{label} CHECK not found in DDL"
    return frozenset(re.findall(r"'([^']+)'", match.group(1)))


def test_batch_statuses_match_ddl_check() -> None:
    values = _check_values(
        tasks_ddl.DDL,
        r"status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'pending'\s+CHECK\s+\(\s*status\s+IN\s+\(([^)]+)\)\s*\)",
        "analysis_batches.status",
    )
    assert values == ALLOWED_BATCH_STATUSES
    assert BATCH_STATUS_CHECK_SQL in tasks_ddl.DDL
    assert set(ALL_BATCH_STATUSES) == ALLOWED_BATCH_STATUSES


def test_source_statuses_match_ddl_check() -> None:
    values = _check_values(
        sources_ddl.DDL,
        r"status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'disconnected'\s+CHECK\s+\(\s*status\s+IN\s+\(([^)]+)\)\s*\)",
        "sources.status",
    )
    assert values == ALLOWED_SOURCE_STATUSES
    assert SOURCE_STATUS_CHECK_SQL in sources_ddl.DDL
    assert set(ALL_SOURCE_STATUSES) == ALLOWED_SOURCE_STATUSES


def test_item_statuses_match_ddl_check() -> None:
    values = _check_values(
        items_ddl.DDL,
        r"status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'active'\s+CHECK\s+\(\s*status\s+IN\s+\(([^)]+)\)\s*\)",
        "items.status",
    )
    assert values == ALLOWED_ITEM_STATUSES
    assert ITEM_STATUS_CHECK_SQL in items_ddl.DDL
    assert set(ALL_ITEM_STATUSES) == ALLOWED_ITEM_STATUSES


def test_action_trigger_statuses_match_ddl_check() -> None:
    values = _check_values(
        actions_ddl.DDL,
        r"status\s+TEXT\s+NOT\s+NULL\s+CHECK\s+\(\s*status\s+IN\s+\(([^)]+)\)\s*\)",
        "action_trigger_history.status",
    )
    assert values == ALLOWED_ACTION_TRIGGER_STATUSES
    assert ACTION_TRIGGER_STATUS_CHECK_SQL in actions_ddl.DDL
    assert set(ALL_ACTION_TRIGGER_STATUSES) == ALLOWED_ACTION_TRIGGER_STATUSES
