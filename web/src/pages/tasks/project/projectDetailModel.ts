/**
 * Pure selectors for the project detail page (parent = agent + outputCalendar).
 */

import type { UserEvent } from "../../../api/userEvents";
import type { AnalysisTask } from "../../../types/tasks";
import type { TaskActivitySpan } from "../../../types/analysis";

export function isProjectTask(task: AnalysisTask | null | undefined): boolean {
  return task?.analysisMode === "agent" && Boolean(task.outputCalendar);
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
      span.sourceKind === "workset" ? span.worksetId === id : span.taskId === id,
    ) ?? null
  );
}

/** Outcome of fetching one child recurring task's schedule subresource. */
export type ChildScheduleFetchResult =
  | { childId: string; kind: "ok"; rrule: string }
  | { childId: string; kind: "missing" }
  | { childId: string; kind: "error"; message: string };

/**
 * Merge child schedule fetch outcomes into displayed RRULEs.
 * Failures must not look like empty RRULE: preserve the last success and
 * surface the first error message.
 */
export function mergeChildRrules(
  prev: ReadonlyMap<string, string>,
  results: readonly ChildScheduleFetchResult[],
): { rrules: Map<string, string>; error: string | null } {
  const rrules = new Map<string, string>();
  let error: string | null = null;
  for (const row of results) {
    if (row.kind === "ok") {
      if (row.rrule) rrules.set(row.childId, row.rrule);
      continue;
    }
    if (row.kind === "missing") {
      continue;
    }
    const kept = prev.get(row.childId);
    if (kept) rrules.set(row.childId, kept);
    if (!error) error = row.message;
  }
  return { rrules, error };
}
