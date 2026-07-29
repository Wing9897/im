/**
 * Pure selectors for the project detail page (parent = analysisMode project).
 */

import type { UserEvent } from "../../../api/userEvents";
import type { AnalysisTask } from "../../../types/tasks";
import type { TaskActivitySpan } from "../../../types/analysis";

export function isProjectTask(task: AnalysisTask | null | undefined): boolean {
  return task?.analysisMode === "project";
}

/** Child recurring rows owned by this project (`parent_task_id`). */
export function selectProjectChildren(
  tasks: readonly AnalysisTask[],
  projectId: string,
): AnalysisTask[] {
  return tasks.filter(
    (task) => task.parentTaskId === projectId && task.analysisMode === "recurring",
  );
}

/** Top-level tasks only — hide project children from the main tasks grid. */
export function selectTopLevelTasks(tasks: readonly AnalysisTask[]): AnalysisTask[] {
  return tasks.filter((task) => !task.parentTaskId);
}

export function selectOwnedUserEvents(
  events: readonly UserEvent[],
  projectId: string,
): UserEvent[] {
  return events.filter((event) => event.taskId === projectId);
}

export function findActivitySpan(
  spans: readonly TaskActivitySpan[],
  taskId: string,
): TaskActivitySpan | null {
  return spans.find((span) => span.taskId === taskId) ?? null;
}
