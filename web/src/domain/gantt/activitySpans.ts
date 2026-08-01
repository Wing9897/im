import { fetchTaskActivitySpans } from "../../api/tasks";
import type { TaskActivitySpan } from "../../types";
import { isWorksetActivitySpan } from "../../types/analysis";

/** Default board embed row budget (task rows + workset ownership rows). */
export const GANTT_EMBED_SPAN_LIMIT = 40;

/**
 * Cap task rows but always keep every ownership span (`sourceKind=workset`)
 * so multi-workset rows are not squeezed out of the embed limit.
 */
export function takeGanttSpans(
  rows: TaskActivitySpan[],
  limit = GANTT_EMBED_SPAN_LIMIT,
): TaskActivitySpan[] {
  const worksetSpans = rows.filter((row) => isWorksetActivitySpan(row));
  const taskRows = rows.filter((row) => !isWorksetActivitySpan(row));
  const room = Math.max(0, limit - worksetSpans.length);
  return [...taskRows.slice(0, room), ...worksetSpans];
}

/** Shared activity-spans fetch used by Timeline Gantt and Board Gantt widgets. */
export function loadGanttActivitySpans(
  options?: { limit?: number },
): Promise<TaskActivitySpan[]> {
  const limit = options?.limit;
  return fetchTaskActivitySpans().then((rows) =>
    limit == null ? rows : takeGanttSpans(rows, limit),
  );
}
