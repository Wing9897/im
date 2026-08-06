/**
 * User-event helpers: provenance task ids vs ownership workset ids.
 *
 * - `taskId` on user_events = analysis-task provenance only (never `__user__`).
 * - `worksetId` = ownership (builtin `__user__` displayed as「一般」).
 */

import i18n from "../../i18n";
import {
  isTimelineAssignableAnalysisMode,
} from "../tasks/analysisModeCapabilities";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";

export { isTimelineAssignableAnalysisMode } from "../tasks/analysisModeCapabilities";

/** Localized display name for builtin workset `__user__`. */
export function getGeneralWorksetLabel(): string {
  return String(i18n.t("common:workset.generalName"));
}

/**
 * True when analysis-task provenance is absent.
 * Legacy wire may still carry `__user__` as a fake task id — treat as null provenance.
 */
export function isNullProvenanceTaskId(taskId: string | null | undefined): boolean {
  return taskId == null || taskId === "" || taskId === SYSTEM_WORKSET_ID;
}

/** Normalize ownership workset id for forms / prefs (empty → builtin `__user__`). */
export function toUserEventFormWorksetId(worksetId: string | null | undefined): string {
  if (typeof worksetId !== "string") return SYSTEM_WORKSET_ID;
  const trimmed = worksetId.trim();
  return trimmed || SYSTEM_WORKSET_ID;
}

/**
 * Optional preselect for "create user event" (deep-link / toolbar).
 * Non-strings (e.g. React click events leaked via onClick={handler}) → null.
 */
export function normalizeOptionalWorksetId(worksetId: unknown): string | null {
  if (typeof worksetId !== "string") return null;
  const trimmed = worksetId.trim();
  return trimmed || null;
}

type AssignableTaskLike = {
  id: string;
  name: string;
  analysisMode?: string | null;
  isActive?: boolean;
  parentTaskId?: string | null;
};

/** Filter to event/recurring/project tasks; exclude project children. */
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

export type WorksetNameLookup =
  | ReadonlyMap<string, string>
  | Readonly<Record<string, string>>;

function lookupName(id: string, names?: TaskNameLookup | WorksetNameLookup): string | undefined {
  if (!names) return undefined;
  return names instanceof Map
    ? (names as ReadonlyMap<string, string>).get(id)
    : (names as Readonly<Record<string, string>>)[id];
}

/**
 * Display label for a user_event row's "source" column:
 * 1. Real analysis-task provenance name when `taskId` is set
 * 2. Else ownership workset name (`__user__` →「一般」)
 */
export function resolveUserEventTaskName(
  taskId: string | null | undefined,
  taskNameById?: TaskNameLookup,
  generalWorksetLabel?: string,
  worksetId?: string | null,
  worksetNameById?: WorksetNameLookup,
): string {
  if (!isNullProvenanceTaskId(taskId)) {
    const id = String(taskId);
    return lookupName(id, taskNameById) ?? id;
  }
  const wid = toUserEventFormWorksetId(worksetId);
  if (wid === SYSTEM_WORKSET_ID) {
    return generalWorksetLabel ?? getGeneralWorksetLabel();
  }
  return lookupName(wid, worksetNameById) ?? wid;
}
