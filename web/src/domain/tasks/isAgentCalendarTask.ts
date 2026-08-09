import type { AnalysisTask } from "../../types/tasks";

/** Agent calendar task = agent mode with output calendar enabled. */
export function isAgentCalendarTask(task: AnalysisTask | null | undefined): boolean {
  return task?.analysisMode === "agent" && Boolean(task.outputCalendar);
}
