import {
  expandWorksetIdsToTaskIds,
  isEmptySourceFilter,
  type SourceFilterSelection,
} from "../../domain/tasks/sourceFilterSelection";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";

/** Multi-select plan: which sources to fetch and how to client-filter. */
export type TimelineFilterPlan = {
  fetchAnalysis: boolean;
  fetchCalendar: boolean;
  fetchUserEvents: boolean;
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
  tasks: ReadonlyArray<{ id: string; analysisMode: string; worksetId?: string | null }>,
): TimelineFilterPlan {
  if (selection === null) {
    return {
      fetchAnalysis: true,
      fetchCalendar: true,
      fetchUserEvents: true,
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
    const mode = byId.get(id)?.analysisMode;
    if (mode === "recurring") {
      recurringTaskIds.push(id);
      fetchUserForTagged = true;
    } else if (mode === "calendar_task") {
      fetchUserForTagged = true;
    } else if (mode === "project") {
      recurringTaskIds.push(id);
      fetchUserForTagged = true;
    } else {
      analysisTaskIds.push(id);
      fetchUserForTagged = true;
    }
  }

  // Workset-only selection (e.g. only __user__) still needs user events.
  const fetchUserEvents =
    includeGeneralWorksetUserEvents ||
    fetchUserForTagged ||
    selectedWorksetIds.some((id) => id !== SYSTEM_WORKSET_ID);

  return {
    fetchAnalysis: analysisTaskIds.length > 0,
    fetchCalendar: recurringTaskIds.length > 0,
    fetchUserEvents,
    analysisTaskIds: analysisTaskIds.length > 0 ? analysisTaskIds : [],
    recurringTaskIds: recurringTaskIds.length > 0 ? recurringTaskIds : [],
    selectedRealTaskIds,
    explicitTaskIds,
    selectedWorksetIds,
    includeGeneralWorksetUserEvents,
  };
}
