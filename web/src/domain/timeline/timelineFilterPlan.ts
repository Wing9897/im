/**
 * Timeline source-filter → fetch/merge plan.
 *
 * Shared by Timeline data hooks and the source-filter match matrix (vs Board).
 */

import {
  getAnalysisModeCapabilities,
  taskWritesAnalysisEvents,
} from "../tasks/analysisModeCapabilities";
import {
  expandWorksetIdsToTaskIds,
  isEmptySourceFilter,
  type SourceFilterSelection,
} from "../tasks/sourceFilterSelection";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";

type TimelineFilterTask = {
  id: string;
  analysisMode: string;
  worksetId?: string | null;
  outputAnalysisEvents?: boolean | null;
  outputCalendar?: boolean | null;
};

/** Multi-select plan: which sources to fetch and how to client-filter. */
export type TimelineFilterPlan = {
  fetchAnalysis: boolean;
  fetchCalendar: boolean;
  fetchUserEvents: boolean;
  /** Items are owned by workset only — not an isolated filter bucket. */
  fetchItems: boolean;
  /** `null` = no task_id filter (all); otherwise IN list for event-mode tasks. */
  analysisTaskIds: string[] | null;
  /** `null` = all recurring; otherwise IN list for recurring tasks. */
  recurringTaskIds: string[] | null;
  /**
   * Task ids used for analysis / RRULE fetch + calendar client filter:
   * explicit selection ∪ members of selected worksets.
   */
  selectedRealTaskIds: string[];
  /**
   * Explicitly checked task ids only (not workset expansion).
   * Used for user_event provenance matching.
   */
  explicitTaskIds: string[];
  /** Selected workset ids (incl. builtin `__user__`). */
  selectedWorksetIds: string[];
  /** True when builtin「一般」workset is in the selection (fetch/filter its user_events). */
  includeGeneralWorksetUserEvents: boolean;
};

/**
 * Resolve hierarchical filter (`null` / `{ taskIds, worksetIds }`) into fetch + merge flags.
 * Selecting a workset includes member-task analysis/calendar + that workset's user_events.
 * Selecting a task alone includes only that task's rows (not the parent workset's user_events).
 */
export function resolveTimelineFilterPlan(
  selection: SourceFilterSelection,
  tasks: ReadonlyArray<TimelineFilterTask>,
): TimelineFilterPlan {
  if (selection === null) {
    return {
      fetchAnalysis: true,
      fetchCalendar: true,
      fetchUserEvents: true,
      fetchItems: true,
      analysisTaskIds: null,
      recurringTaskIds: null,
      selectedRealTaskIds: [],
      explicitTaskIds: [],
      selectedWorksetIds: [],
      includeGeneralWorksetUserEvents: true,
    };
  }

  if (isEmptySourceFilter(selection)) {
    return {
      fetchAnalysis: false,
      fetchCalendar: false,
      fetchUserEvents: false,
      fetchItems: false,
      analysisTaskIds: [],
      recurringTaskIds: [],
      selectedRealTaskIds: [],
      explicitTaskIds: [],
      selectedWorksetIds: [],
      includeGeneralWorksetUserEvents: false,
    };
  }

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const selectedWorksetIds = [...selection.worksetIds];
  const includeGeneralWorksetUserEvents = selectedWorksetIds.includes(SYSTEM_WORKSET_ID);
  const fromWorksets = expandWorksetIdsToTaskIds(selectedWorksetIds, tasks);
  const explicitTaskIds = [...selection.taskIds];
  const selectedRealTaskIds = [
    ...new Set([...explicitTaskIds, ...fromWorksets]),
  ];

  const analysisTaskIds: string[] = [];
  const recurringTaskIds: string[] = [];
  let fetchUserForTagged = false;

  for (const id of selectedRealTaskIds) {
    const task = byId.get(id);
    if (!task) continue;
    const mode = task.analysisMode;
    const caps = getAnalysisModeCapabilities(mode);
    if (!caps) continue;
    if (taskWritesAnalysisEvents(task)) {
      analysisTaskIds.push(id);
      fetchUserForTagged = true;
    } else if (mode === "agent" && Boolean(task.outputCalendar)) {
      // Calendar-output agent: refresh user_events / child provenance, not analysis_events.
      fetchUserForTagged = true;
    }
    // leaderboard (and unknown) — not a timeline analysis_events source
  }

  // Workset-only selection (e.g. only __user__) still needs user events.
  const fetchUserEvents =
    includeGeneralWorksetUserEvents ||
    fetchUserForTagged ||
    selectedWorksetIds.some((id) => id !== SYSTEM_WORKSET_ID);
  // Items ride along with selected worksets (no separate items bucket).
  const fetchItems = selectedWorksetIds.length > 0;

  const fetchRecurringForWorkset = selectedWorksetIds.length > 0;
  return {
    fetchAnalysis: analysisTaskIds.length > 0,
    fetchCalendar: fetchRecurringForWorkset || recurringTaskIds.length > 0,
    fetchUserEvents,
    fetchItems,
    analysisTaskIds: analysisTaskIds.length > 0 ? analysisTaskIds : [],
    recurringTaskIds: fetchRecurringForWorkset
      ? null
      : recurringTaskIds.length > 0
        ? recurringTaskIds
        : [],
    selectedRealTaskIds,
    explicitTaskIds,
    selectedWorksetIds,
    includeGeneralWorksetUserEvents,
  };
}
