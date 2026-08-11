/**
 * Pure selectors for agent (project-detail) task views and shared grids.
 */

import type { UserEvent } from "../../api/userEvents";
import type { AnalysisTask } from "../../types/tasks";
import type { TaskActivitySpan } from "../../types/analysis";
import type { RecurringSeries } from "../../types/recurring";
import { isAgentCalendarTask } from "./isAgentCalendarTask";

export { isAgentCalendarTask };

/** Child recurring rows owned by this project (`parent_task_id`). */
export function selectProjectChildren(
  series: readonly RecurringSeries[],
  projectId: string,
): RecurringSeries[] {
  return series.filter((row) => row.parentTaskId === projectId);
}

/** Analysis tasks are always catalog rows (child series live under `/calendar/recurring`). */
export function selectTopLevelTasks(
  tasks: readonly AnalysisTask[],
): AnalysisTask[] {
  return [...tasks];
}

export function selectOwnedUserEvents(
  events: readonly UserEvent[],
  projectId: string,
): UserEvent[] {
  return events.filter((event) => event.taskId === projectId);
}

/**
 * Locate a Gantt activity span by row id.
 * Task rows match `taskId`; workset rows (`sourceKind=workset`) match `worksetId`.
 */
export function findActivitySpan(
  spans: readonly TaskActivitySpan[],
  id: string,
): TaskActivitySpan | null {
  return (
    spans.find((span) =>
      span.sourceKind === "workset"
        ? span.worksetId === id
        : span.taskId === id,
    ) ?? null
  );
}
