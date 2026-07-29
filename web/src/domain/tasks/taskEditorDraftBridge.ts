import type { TaskDraftPayload, TaskFormState } from "../../types";

/** Agent chat surface when the global assistant may consult the task advisor. */
export const AGENT_SURFACE_TASK_EDITOR = "task_editor" as const;

/** Tool name the assistant uses to delegate form edits to the task advisor. */
export const TASKS_CONSULT_ADVISOR_TOOL = "tasks.consult_advisor";

export type TaskEditorDraftBridge = {
  getCurrentTask: () => TaskDraftPayload;
  applyTaskConfig: (config: Partial<TaskFormState>) => void;
};

let activeBridge: TaskEditorDraftBridge | null = null;

/**
 * Registers the live Chat Editor draft bridge (one mount at a time).
 * Returns a dispose function that clears the bridge only if it is still current.
 */
export function registerTaskEditorDraftBridge(
  bridge: TaskEditorDraftBridge,
): () => void {
  activeBridge = bridge;
  return () => {
    if (activeBridge === bridge) {
      activeBridge = null;
    }
  };
}

/** Returns the registered bridge, or null when not on a mounted task editor. */
export function getTaskEditorDraftBridge(): TaskEditorDraftBridge | null {
  return activeBridge;
}

/** Clears any registered bridge (tests / forced teardown). */
export function clearTaskEditorDraftBridge(): void {
  activeBridge = null;
}

/**
 * True for task create/edit routes that enable the advisor surface gate.
 * Matches `/tasks/new` and `/tasks/:taskId/edit`.
 */
export function isTaskEditorPath(pathname: string): boolean {
  if (pathname === "/tasks/new") return true;
  return /^\/tasks\/[^/]+\/edit\/?$/.test(pathname);
}
