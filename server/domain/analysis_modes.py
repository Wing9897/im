"""Single source of truth for ``analysis_tasks.analysis_mode`` vocabulary.

Wire / OpenAPI / FE ``AnalysisMode`` must stay aligned with these constants.

Process-layer registry: each mode is an ``AnalysisModeSpec``. Capability
frozensets below are **derived** from the specs so schedulers / writers /
timeline filters share one declaration.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Literal

LEADERBOARD_MODE: Final = "leaderboard"
EVENT_MODE: Final = "event"
CHILD_RECURRING_MODE: Final = "recurring"
CALENDAR_TASK_MODE: Final = "calendar_task"
PARENT_PROJECT_MODE: Final = "project"

AnalysisMode = Literal[
    "leaderboard",
    "event",
    "recurring",
    "calendar_task",
    "project",
]

#: How the mode is executed at runtime (developer-facing; drives which code path owns work).
AnalysisPipeline = Literal["message_batch", "project_tick", "rrule_expand", "filter_bucket"]


@dataclass(frozen=True, slots=True)
class AnalysisModeSpec:
    """Declarative capabilities for one analysis mode.

    Add a mode by appending to ``ANALYSIS_MODE_SPECS``, then align DDL CHECK,
    OpenAPI / FE ``AnalysisMode``, task form visibility, and the pipeline
    implementation named by ``pipeline``.
    """

    mode: AnalysisMode
    ai: bool
    schedulable: bool
    message_batch: bool
    timeline_owning: bool
    pipeline: AnalysisPipeline


ANALYSIS_MODE_SPECS: Final[tuple[AnalysisModeSpec, ...]] = (
    AnalysisModeSpec(
        mode=LEADERBOARD_MODE,
        ai=True,
        schedulable=True,
        message_batch=True,
        timeline_owning=False,
        pipeline="message_batch",
    ),
    AnalysisModeSpec(
        mode=EVENT_MODE,
        ai=True,
        schedulable=True,
        message_batch=True,
        timeline_owning=True,
        pipeline="message_batch",
    ),
    AnalysisModeSpec(
        mode=CHILD_RECURRING_MODE,
        ai=False,
        schedulable=False,
        message_batch=False,
        timeline_owning=True,
        pipeline="rrule_expand",
    ),
    AnalysisModeSpec(
        mode=CALENDAR_TASK_MODE,
        ai=False,
        schedulable=False,
        message_batch=False,
        timeline_owning=True,
        pipeline="filter_bucket",
    ),
    AnalysisModeSpec(
        mode=PARENT_PROJECT_MODE,
        ai=True,
        schedulable=True,
        message_batch=False,
        timeline_owning=True,
        pipeline="project_tick",
    ),
)

ANALYSIS_MODE_BY_ID: Final[dict[str, AnalysisModeSpec]] = {spec.mode: spec for spec in ANALYSIS_MODE_SPECS}

ALL_ANALYSIS_MODES: Final[tuple[AnalysisMode, ...]] = tuple(spec.mode for spec in ANALYSIS_MODE_SPECS)

#: Modes that run AI analysis (scheduler batch or project tick).
AI_ANALYSIS_MODES: Final[frozenset[str]] = frozenset(spec.mode for spec in ANALYSIS_MODE_SPECS if spec.ai)

#: Modes the scheduler registers for timed runs (excludes RRULE / filter buckets).
SCHEDULABLE_ANALYSIS_MODES: Final[frozenset[str]] = frozenset(
    spec.mode for spec in ANALYSIS_MODE_SPECS if spec.schedulable
)

#: Modes that use the incremental message-batch pipeline (not project ticks).
MESSAGE_BATCH_ANALYSIS_MODES: Final[frozenset[str]] = frozenset(
    spec.mode for spec in ANALYSIS_MODE_SPECS if spec.message_batch
)

#: Modes that may own timed ``user_events`` / appear in timeline assignable lists.
TIMELINE_OWNING_ANALYSIS_MODES: Final[frozenset[str]] = frozenset(
    spec.mode for spec in ANALYSIS_MODE_SPECS if spec.timeline_owning
)

#: Modes that never receive APScheduler timers (RRULE / filter buckets only).
NON_SCHEDULABLE_ANALYSIS_MODES: Final[frozenset[str]] = frozenset(
    spec.mode for spec in ANALYSIS_MODE_SPECS if not spec.schedulable
)

#: Modes skipped by the incremental message batch pipeline (includes project → tick).
SKIP_BATCH_ANALYSIS_MODES: Final[frozenset[str]] = frozenset(
    spec.mode for spec in ANALYSIS_MODE_SPECS if not spec.message_batch
)


def get_analysis_mode_spec(mode: str | None) -> AnalysisModeSpec | None:
    """Lookup registry entry; unknown / empty → None."""
    if not mode:
        return None
    return ANALYSIS_MODE_BY_ID.get(mode)
