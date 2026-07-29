import i18n from "../../i18n";
import {
  isTimelineAssignableAnalysisMode,
} from "../tasks/analysisModeCapabilities";

export { isTimelineAssignableAnalysisMode } from "../tasks/analysisModeCapabilities";

/** Sentinel for the toolbar filter: only user-authored events (manual + assistant). */
export const USER_EVENTS_FILTER_ID = "__user__";

/** Shared UI label for manual + assistant user events (follows active UI locale). */
export function getUserEventsFilterLabel(): string {
  return String(i18n.t("timeline:toolbar.userOrAssistant"));
}

/** True when a user_event has no owning analysis task (toolbar「用戶或助手」). */
export function isUnassignedUserEventTaskId(taskId: string | null | undefined): boolean {
  return taskId == null || taskId === "" || taskId === USER_EVENTS_FILTER_ID;
}

/**
 * Normalize a wire/form/filter task id:
 * unassigned → `__user__`; otherwise the real task id.
 */
export function toUserEventWriteTaskId(taskId: string | null | undefined): string {
  return isUnassignedUserEventTaskId(taskId) ? USER_EVENTS_FILTER_ID : String(taskId);
}

/** Form/select value for an event's task ownership (defaults to `__user__`). */
export const toUserEventFormTaskId = toUserEventWriteTaskId;

/** Board / timeline / voice filter id (same sentinel normalization as write). */
export const toFilterTaskId = toUserEventWriteTaskId;

type AssignableTaskLike = {
  id: string;
  name: string;
  analysisMode?: string | null;
  isActive?: boolean;
  parentTaskId?: string | null;
};

/** Filter to event/recurring/calendar_task/project tasks; exclude project children. */
export function filterAssignableTimelineTasks<T extends AssignableTaskLike>(
  tasks: readonly T[],
  opts?: { activeOnly?: boolean },
): T[] {
  const activeOnly = Boolean(opts?.activeOnly);
  return tasks.filter((task) => {
    if (task.parentTaskId) return false;
    if (!isTimelineAssignableAnalysisMode(task.analysisMode)) return false;
    if (activeOnly && !task.isActive) return false;
    return true;
  });
}

/** Index task display names by id for `resolveUserEventTaskName`. */
export function buildTaskNameById(
  tasks: readonly { id: string; name: string }[],
): ReadonlyMap<string, string> {
  return new Map(tasks.map((task) => [task.id, task.name]));
}

/** Either shape callers already hold: a Map from the catalog or a plain record. */
export type TaskNameLookup =
  | ReadonlyMap<string, string>
  | Readonly<Record<string, string>>;

/**
 * Resolve display name for a user_event task id (unassigned → locale label).
 *
 * React callers pass `unassignedLabel` from `useUserEventsFilterLabel` so the
 * memo that wraps this call re-runs on a language switch.
 */
export function resolveUserEventTaskName(
  taskId: string | null | undefined,
  taskNameById?: TaskNameLookup,
  unassignedLabel?: string,
): string {
  if (isUnassignedUserEventTaskId(taskId)) {
    return unassignedLabel ?? getUserEventsFilterLabel();
  }
  const id = String(taskId);
  if (!taskNameById) {
    return id;
  }
  // `instanceof Map` widens to `Map<any, any>` rather than narrowing the union,
  // so both arms need an explicit cast.
  const name =
    taskNameById instanceof Map
      ? (taskNameById as ReadonlyMap<string, string>).get(id)
      : (taskNameById as Readonly<Record<string, string>>)[id];
  return name ?? id;
}
