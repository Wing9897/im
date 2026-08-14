"""Drift guards for ``llm_staff_instances.staff_class`` Python SoT vs DDL CHECK."""

from __future__ import annotations

import re

from server.db.schema_domains import llm as llm_ddl
from server.domain.llm_staff_classes import (
    ALLOWED_LLM_STAFF_CLASSES,
    LLM_STAFF_CLASS_CHECK_SQL,
    LLM_STAFF_CLASSES,
    LLM_TASK_STAFF_CLASSES,
)

_STAFF_CHECK = re.compile(
    r"staff_class\s+TEXT\s+NOT\s+NULL\s+"
    r"CHECK\s+\(\s*staff_class\s+IN\s+\(([^)]+)\)\s*\)",
    re.IGNORECASE,
)


def _ddl_staff_values() -> frozenset[str]:
    match = _STAFF_CHECK.search(llm_ddl.DDL)
    assert match is not None, "llm_staff_instances.staff_class CHECK not found in LLM DDL"
    return frozenset(re.findall(r"'([^']+)'", match.group(1)))


def test_llm_staff_classes_match_ddl_check() -> None:
    assert _ddl_staff_values() == ALLOWED_LLM_STAFF_CLASSES
    assert LLM_STAFF_CLASS_CHECK_SQL in llm_ddl.DDL
    assert "assistant" not in ALLOWED_LLM_STAFF_CLASSES
    assert tuple(LLM_TASK_STAFF_CLASSES) == tuple(LLM_STAFF_CLASSES)
    assert len(LLM_STAFF_CLASSES) == len(set(LLM_STAFF_CLASSES))
