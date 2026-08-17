"""Single source of truth for ``analysis_tasks.analysis_mode`` vocabulary.

Wire / OpenAPI / FE ``AnalysisMode`` must stay aligned with these constants.

Process-layer registry: each mode is an ``AnalysisModeSpec``. Capability
frozensets below are **derived** from the specs so schedulers / writers /
timeline filters share one declaration.

Recurring calendar series are **not** an analysis mode — they live on
``recurring_schedules`` (calendar domain) and are edited via
``/api/v1/calendar/recurring*``.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Final, Literal

LEADERBOARD_MODE: Final = "leaderboard"
INTEL_EVENT_MODE: Final = "intel_event"
AGENT_MODE: Final = "agent"

AnalysisMode = Literal[
    "leaderboard",
    "intel_event",
    "agent",
]

#: How the mode is executed at runtime (developer-facing; drives which code path owns work).
AnalysisPipeline = Literal["message_batch", "agent_tick"]


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
        mode=INTEL_EVENT_MODE,
        ai=True,
        schedulable=True,
        message_batch=True,
        timeline_owning=True,
        pipeline="message_batch",
    ),
    AnalysisModeSpec(
        mode=AGENT_MODE,
        ai=True,
        schedulable=True,
        message_batch=False,
        timeline_owning=True,
        pipeline="agent_tick",
    ),
)

ANALYSIS_MODE_BY_ID: Final[dict[str, AnalysisModeSpec]] = {spec.mode: spec for spec in ANALYSIS_MODE_SPECS}

ALL_ANALYSIS_MODES: Final[tuple[AnalysisMode, ...]] = tuple(spec.mode for spec in ANALYSIS_MODE_SPECS)

#: Modes that run AI analysis (scheduler batch or agent tick).
AI_ANALYSIS_MODES: Final[frozenset[str]] = frozenset(spec.mode for spec in ANALYSIS_MODE_SPECS if spec.ai)

#: Modes the scheduler registers for timed runs.
SCHEDULABLE_ANALYSIS_MODES: Final[frozenset[str]] = frozenset(
    spec.mode for spec in ANALYSIS_MODE_SPECS if spec.schedulable
)

#: Modes that use the incremental message-batch pipeline (not agent ticks).
MESSAGE_BATCH_ANALYSIS_MODES: Final[frozenset[str]] = frozenset(
    spec.mode for spec in ANALYSIS_MODE_SPECS if spec.message_batch
)

#: Modes that may own timed ``user_events`` / appear in timeline assignable lists.
TIMELINE_OWNING_ANALYSIS_MODES: Final[frozenset[str]] = frozenset(
    spec.mode for spec in ANALYSIS_MODE_SPECS if spec.timeline_owning
)

#: Modes that never receive APScheduler timers.
NON_SCHEDULABLE_ANALYSIS_MODES: Final[frozenset[str]] = frozenset(
    spec.mode for spec in ANALYSIS_MODE_SPECS if not spec.schedulable
)

#: Modes skipped by the incremental message batch pipeline (includes agent → tick).
SKIP_BATCH_ANALYSIS_MODES: Final[frozenset[str]] = frozenset(
    spec.mode for spec in ANALYSIS_MODE_SPECS if not spec.message_batch
)


ANALYSIS_MODE_CHECK_SQL = "CHECK (analysis_mode IN ({}))".format(",".join(f"'{value}'" for value in ALL_ANALYSIS_MODES))


def get_analysis_mode_spec(mode: str | None) -> AnalysisModeSpec | None:
    """Lookup registry entry; unknown / empty → None."""
    if not mode:
        return None
    return ANALYSIS_MODE_BY_ID.get(mode)


def task_writes_analysis_events(task: Mapping[str, Any] | None) -> bool:
    """Whether this run persists ``analysis_events`` (Intelligence page).

    ``intel_event`` / ``agent`` honor ``output_analysis_events`` (missing /
    null → skip). ``leaderboard`` never writes ``analysis_events`` — it always
    persists ``trending_topics`` for the leaderboard page (see
    ``task_persists_findings``). FE ``taskWritesAnalysisEvents`` is the
    Intelligence-page listing filter and must not be merged with this helper.
    """
    if not task:
        return False
    mode = str(task.get("analysis_mode") or "")
    if mode == LEADERBOARD_MODE:
        return False
    flag = _column_flag_on(task.get("output_analysis_events"))
    if mode == INTEL_EVENT_MODE:
        return flag
    return mode == AGENT_MODE and flag


def task_persists_findings(task: Mapping[str, Any] | None) -> bool:
    """Whether this run should persist mode findings (events or topics).

    Leaderboard always stores ``trending_topics`` (排行榜 page / notify),
    independent of ``output_analysis_events``. Intel / agent still follow
    ``task_writes_analysis_events``.
    """
    if not task:
        return False
    mode = str(task.get("analysis_mode") or "")
    if mode == LEADERBOARD_MODE:
        return True
    return task_writes_analysis_events(task)


def _column_flag_on(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    try:
        return bool(int(value))
    except (TypeError, ValueError):
        return bool(value)
