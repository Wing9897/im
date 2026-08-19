"""Drift guards for ``notify_pref`` Python SoT vs DDL CHECK.

The same CHECK is embedded on ``user_events``, ``recurring_schedules``, and
``analysis_tasks``.
"""

from __future__ import annotations

import re

from server.db.schema_domains import calendar as calendar_ddl
from server.db.schema_domains import tasks as tasks_ddl
from server.db.schema_domains import worksets as worksets_ddl
from server.domain.notify_prefs import (
    ALL_NOTIFY_PREFS,
    ALLOWED_NOTIFY_PREFS,
    NOTIFY_PREF_CHECK_SQL,
    normalize_notify_pref,
)

_NOTIFY_CHECK = re.compile(
    r"notify_pref\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'(inherit|off)'\s+"
    r"CHECK\s+\(\s*notify_pref\s+IN\s+\(([^)]+)\)\s*\)",
    re.IGNORECASE,
)


def _ddl_notify_matches(ddl: str, label: str) -> list[tuple[str, str]]:
    matches = _NOTIFY_CHECK.findall(ddl)
    assert matches, f"{label} notify_pref CHECK not found in DDL"
    return [(default.lower(), group) for default, group in matches]


def _ddl_notify_values(ddl: str, label: str) -> frozenset[str]:
    matches = _ddl_notify_matches(ddl, label)
    values = {frozenset(re.findall(r"'([^']+)'", group)) for _, group in matches}
    assert len(values) == 1, f"{label}: notify_pref CHECK sets drifted across columns"
    return values.pop()


def test_notify_prefs_match_ddl_check() -> None:
    """Python SoT must equal the wipe-only DDL CHECK set (no silent drift)."""
    calendar_matches = _ddl_notify_matches(calendar_ddl.DDL, "calendar")
    tasks_matches = _ddl_notify_matches(tasks_ddl.DDL, "tasks")
    calendar_values = _ddl_notify_values(calendar_ddl.DDL, "calendar")
    tasks_values = _ddl_notify_values(tasks_ddl.DDL, "tasks")
    assert calendar_values == ALLOWED_NOTIFY_PREFS
    assert tasks_values == ALLOWED_NOTIFY_PREFS
    assert {default for default, _ in calendar_matches} == {"off"}
    assert {default for default, _ in tasks_matches} == {"inherit"}
    assert calendar_ddl.DDL.count(NOTIFY_PREF_CHECK_SQL) == 2
    assert NOTIFY_PREF_CHECK_SQL in tasks_ddl.DDL
    assert len(ALL_NOTIFY_PREFS) == len(set(ALL_NOTIFY_PREFS))
    assert set(ALL_NOTIFY_PREFS) == ALLOWED_NOTIFY_PREFS
    assert tuple(ALL_NOTIFY_PREFS) == ("inherit", "off")


def test_worksets_notify_enabled_default_on() -> None:
    assert "notify_enabled INTEGER NOT NULL DEFAULT 1" in worksets_ddl.DDL
    assert "external_enabled INTEGER NOT NULL DEFAULT 1" in worksets_ddl.DDL


def test_normalize_notify_pref_blank_and_invalid() -> None:
    assert normalize_notify_pref(None) == "inherit"
    assert normalize_notify_pref("") == "inherit"
    assert normalize_notify_pref("off") == "off"
    from server.domain.notify_prefs import DEFAULT_CALENDAR_NOTIFY_PREF

    assert DEFAULT_CALENDAR_NOTIFY_PREF == "off"
    assert normalize_notify_pref(None, default=DEFAULT_CALENDAR_NOTIFY_PREF) == "off"
    for invalid in ("on", " on ", "maybe", "follow"):
        try:
            normalize_notify_pref(invalid)
        except ValueError as exc:
            assert "notifyPref" in str(exc)
        else:
            raise AssertionError(f"expected ValueError for notifyPref={invalid!r}")


def test_coerced_notify_pref_rejects_legacy_on_and_follow() -> None:
    from pydantic import TypeAdapter, ValidationError

    from server.api.schemas.notify_pref import CoercedNotifyPref

    adapter = TypeAdapter(CoercedNotifyPref)
    for invalid in ("on", "follow"):
        try:
            adapter.validate_python(invalid)
        except ValidationError:
            pass
        else:
            raise AssertionError(f"expected ValidationError for notifyPref={invalid!r}")
    assert adapter.validate_python("inherit") == "inherit"
    assert adapter.validate_python("off") == "off"
