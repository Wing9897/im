"""Single public import surface for household workset-scope helpers."""

from __future__ import annotations

import importlib.util

from server.domain.workset_scope import (
    WORKSET_SCOPED_TOOL_NAMES,
    apply_household_workset_scope,
    bind_workset_ids_sql,
)


def test_workset_scope_lives_only_in_domain() -> None:
    assert importlib.util.find_spec("server.agent.workset_scope") is None
    assert callable(apply_household_workset_scope)
    clause, params = bind_workset_ids_sql("workset_id", ["ws-a", "ws-b"])
    assert clause == "workset_id IN (?, ?)"
    assert params == ["ws-a", "ws-b"]
    assert "worksets.list" in WORKSET_SCOPED_TOOL_NAMES
