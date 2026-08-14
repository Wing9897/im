"""Drift guards for ``analysis_tasks.trigger_mode`` Python SoT vs DDL CHECK."""

from __future__ import annotations

import re

from server.db.schema_domains import tasks as tasks_ddl
from server.domain.agent_task_spec import ALL_TRIGGER_MODES, TRIGGER_MODE_CHECK_SQL

_TRIGGER_MODE_CHECK = re.compile(
    r"trigger_mode\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'schedule'\s+"
    r"CHECK\s+\(\s*trigger_mode\s+IN\s+\(([^)]+)\)\s*\)",
    re.IGNORECASE,
)


def _ddl_trigger_mode_values() -> frozenset[str]:
    match = _TRIGGER_MODE_CHECK.search(tasks_ddl.DDL)
    assert match is not None, "analysis_tasks.trigger_mode CHECK not found in tasks DDL"
    return frozenset(re.findall(r"'([^']+)'", match.group(1)))


def test_trigger_modes_match_ddl_check() -> None:
    assert frozenset(ALL_TRIGGER_MODES) == _ddl_trigger_mode_values()
    assert TRIGGER_MODE_CHECK_SQL in tasks_ddl.DDL
    assert len(ALL_TRIGGER_MODES) == len(set(ALL_TRIGGER_MODES))
