"""Drift guards for ``actions.action_type`` Python SoT vs DDL CHECK + registries."""

from __future__ import annotations

import re

from server.action_config import _SENSITIVE_FIELDS
from server.actions import ACTION_HANDLERS
from server.api.schemas.action_configs import ACTION_CONFIG_SCHEMAS
from server.db.schema_domains import actions as actions_ddl
from server.domain.action_types import (
    ACTION_TYPE_CHECK_SQL,
    ALL_ACTION_TYPES,
    ALLOWED_ACTION_TYPES,
)

_ACTION_TYPE_CHECK = re.compile(
    r"action_type\s+TEXT\s+NOT\s+NULL\s+CHECK\s+\(\s*action_type\s+IN\s+\(([^)]+)\)\s*\)",
    re.IGNORECASE,
)


def _ddl_action_type_values() -> frozenset[str]:
    match = _ACTION_TYPE_CHECK.search(actions_ddl.DDL)
    assert match is not None, "actions.action_type CHECK not found in actions DDL"
    return frozenset(re.findall(r"'([^']+)'", match.group(1)))


def test_action_types_match_ddl_check() -> None:
    assert _ddl_action_type_values() == ALLOWED_ACTION_TYPES
    assert ACTION_TYPE_CHECK_SQL in actions_ddl.DDL
    assert len(ALL_ACTION_TYPES) == len(set(ALL_ACTION_TYPES))
    assert set(ALL_ACTION_TYPES) == ALLOWED_ACTION_TYPES


def test_action_handler_registry_covers_every_type() -> None:
    assert frozenset(ACTION_HANDLERS) == ALLOWED_ACTION_TYPES


def test_sensitive_field_map_covers_every_type() -> None:
    assert frozenset(_SENSITIVE_FIELDS) == ALLOWED_ACTION_TYPES


def test_config_schema_map_covers_every_type() -> None:
    assert frozenset(ACTION_CONFIG_SCHEMAS) == ALLOWED_ACTION_TYPES


def test_sensitive_fields_exist_on_config_schemas() -> None:
    for action_type, sensitive in _SENSITIVE_FIELDS.items():
        model_fields = set(ACTION_CONFIG_SCHEMAS[action_type].model_fields)
        missing = sensitive - model_fields
        assert not missing, f"{action_type}: sensitive fields {sorted(missing)} missing from config schema"
