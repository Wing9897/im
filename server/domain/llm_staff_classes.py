"""Single source of truth for ``llm_staff_instances.staff_class`` vocabulary.

DDL CHECK embeds ``LLM_STAFF_CLASS_CHECK_SQL``. Task-mode classes are the only
values allowed on ``llm_staff_instances`` (assistant / liaison / taskEditor are
global slots in ``system_config``, not staff rows).
"""

from __future__ import annotations

from typing import Final, Literal

LlmStaffClass = Literal["leaderboard", "intel_event", "agent"]

#: Staff classes that may appear on ``llm_staff_instances`` (DDL CHECK).
LLM_STAFF_CLASSES: Final[tuple[LlmStaffClass, ...]] = (
    "leaderboard",
    "intel_event",
    "agent",
)

#: Profile-editor checkbox classes (task picks ``llmProfileId``; not global slots).
LLM_TASK_STAFF_CLASSES: Final[tuple[LlmStaffClass, ...]] = LLM_STAFF_CLASSES

ALLOWED_LLM_STAFF_CLASSES: Final[frozenset[str]] = frozenset(LLM_STAFF_CLASSES)

LLM_STAFF_CLASS_CHECK_SQL = "CHECK (staff_class IN ({}))".format(",".join(f"'{value}'" for value in LLM_STAFF_CLASSES))
