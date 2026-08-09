import type { AnalysisTask } from "../../types/tasks";

/** Parent project = agent task with output calendar enabled. */
export function isProjectTask(task: AnalysisTask | null | undefined): boolean {
  return task?.analysisMode === "agent" && Boolean(task.outputCalendar);
}
