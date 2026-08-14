"""Drift guards for ``llm_profiles.provider`` Python SoT vs DDL CHECK."""

from __future__ import annotations

import re

from server.db.schema_domains import llm as llm_ddl
from server.domain.llm_providers import (
    ALL_LLM_PROVIDERS,
    ALLOWED_LLM_PROVIDERS,
    LLM_PROVIDER_CHECK_SQL,
)

_PROVIDER_CHECK = re.compile(
    r"provider\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'ollama'\s+"
    r"CHECK\s+\(\s*provider\s+IN\s+\(([^)]+)\)\s*\)",
    re.IGNORECASE,
)


def _ddl_provider_values() -> frozenset[str]:
    match = _PROVIDER_CHECK.search(llm_ddl.DDL)
    assert match is not None, "llm_profiles.provider CHECK not found in LLM DDL"
    return frozenset(re.findall(r"'([^']+)'", match.group(1)))


def test_llm_providers_match_ddl_check() -> None:
    assert _ddl_provider_values() == ALLOWED_LLM_PROVIDERS
    assert LLM_PROVIDER_CHECK_SQL in llm_ddl.DDL
    assert len(ALL_LLM_PROVIDERS) == len(set(ALL_LLM_PROVIDERS))
    assert set(ALL_LLM_PROVIDERS) == ALLOWED_LLM_PROVIDERS
