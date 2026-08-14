"""Single source of truth for ``action_trigger_history.status`` vocabulary.

DDL CHECK in ``server/db/schema_domains/actions.py`` embeds
``ACTION_TRIGGER_STATUS_CHECK_SQL``.
"""

from __future__ import annotations

from typing import Final, Literal

ACTION_TRIGGER_SUCCESS: Final = "success"
ACTION_TRIGGER_FAILURE: Final = "failure"

ActionTriggerStatus = Literal["success", "failure"]

ALL_ACTION_TRIGGER_STATUSES: Final[tuple[ActionTriggerStatus, ...]] = (
    ACTION_TRIGGER_SUCCESS,
    ACTION_TRIGGER_FAILURE,
)

ALLOWED_ACTION_TRIGGER_STATUSES: Final[frozenset[str]] = frozenset(ALL_ACTION_TRIGGER_STATUSES)

ACTION_TRIGGER_STATUS_CHECK_SQL = "CHECK (status IN ({}))".format(
    ",".join(f"'{value}'" for value in ALL_ACTION_TRIGGER_STATUSES)
)
