/**
 * Hierarchical source filter selection for timeline / intelligence / board.
 * `null` = all sources; otherwise explicit task + workset multi-select.
 * Wire SoT: OpenAPI ``SourceFilterSelectionSchema`` (arrays optional there;
 * domain always materializes both lists when non-null).
 */

import type { components } from "../../api/generated/schema";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { isNullProvenanceTaskId } from "../timeline/userEvents";

type SourceFilterWire = components["schemas"]["SourceFilterSelectionSchema"];

export type SourceFilterSelection =
  | {
      taskIds: NonNullable<SourceFilterWire["taskIds"]>;
      worksetIds: NonNullable<SourceFilterWire["worksetIds"]>;
    }
  | null;

export type WorksetMemberTask = {
  id: string;
  worksetId?: string | null;
  name?: string;
  /** Optional mode hint for lightweight badges (e.g. recurring). */
  analysisMode?: string | null;
};

/** True when selection means "show nothing". */
export function isEmptySourceFilter(selection: SourceFilterSelection): boolean {
  return selection !== null && selection.taskIds.length === 0 && selection.worksetIds.length === 0;
}

/** Count of checked rows for badge display (tasks + worksets). */
export function sourceFilterSelectedCount(selection: SourceFilterSelection): number {
  if (selection === null) return 0;
  return selection.taskIds.length + selection.worksetIds.length;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === "string");
}

/**
 * Normalize filter values: `null` | `{taskIds,worksetIds}`.
 * Flat `string[]` and unknown shapes → `null` (all sources; hard-cut, no upgrade).
 */
export function parseSourceFilterValue(raw: unknown): SourceFilterSelection {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as { taskIds?: unknown; worksetIds?: unknown };
  if (!isStringArray(obj.taskIds) || !isStringArray(obj.worksetIds)) return null;
  return {
    taskIds: obj.taskIds.filter((id) => id.length > 0),
    worksetIds: obj.worksetIds.filter((id) => id.length > 0),
  };
}

function pruneIdList(selected: string[], catalogIds: readonly string[]): string[] {
  if (catalogIds.length === 0) return selected;
  const allowed = new Set(catalogIds);
  return selected.filter((id) => allowed.has(id));
}

function sameIdList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/**
 * Drop ids that are no longer in the catalog.
 * Empty catalog while loading leaves selection untouched.
 * Returns the same `selection` reference when nothing was pruned, so callers
 * can safely use it as an effect dependency without looping forever.
 */
export function pruneSourceFilter(
  selection: SourceFilterSelection,
  catalogTaskIds: readonly string[],
  catalogWorksetIds: readonly string[] = [SYSTEM_WORKSET_ID],
): SourceFilterSelection {
  if (selection === null) return null;
  if (catalogTaskIds.length === 0 && catalogWorksetIds.length === 0) return selection;
  const taskIds = pruneIdList(selection.taskIds, catalogTaskIds);
  const worksetIds = pruneIdList(selection.worksetIds, catalogWorksetIds);
  if (sameIdList(taskIds, selection.taskIds) && sameIdList(worksetIds, selection.worksetIds)) {
    return selection;
  }
  // Everything previously selected became invalid (e.g. the task was deleted) —
  // reset to "all sources" rather than leaving an explicit empty selection,
  // which would otherwise be indistinguishable from a deliberate "show nothing".
  if (taskIds.length === 0 && worksetIds.length === 0) return null;
  return { taskIds, worksetIds };
}

/**
 * Expand selected worksets into member task ids (for analysis fetch).
 * Does not include top-level selected task ids.
 */
export function expandWorksetIdsToTaskIds(
  selectedWorksetIds: readonly string[],
  tasks: readonly WorksetMemberTask[],
): string[] {
  const selected = new Set(selectedWorksetIds);
  if (selected.size === 0) return [];
  const ids = new Set<string>();
  for (const task of tasks) {
    const wid = task.worksetId?.trim() || SYSTEM_WORKSET_ID;
    if (selected.has(wid)) {
      ids.add(task.id);
    }
  }
  return [...ids].sort();
}

/** Union of explicitly selected tasks + members of selected worksets. */
export function resolveAnalysisTaskIdsFromFilter(
  selection: SourceFilterSelection,
  tasks: readonly WorksetMemberTask[],
): string[] | null {
  if (selection === null) return null;
  const fromWorksets = expandWorksetIdsToTaskIds(selection.worksetIds, tasks);
  const ids = new Set([...selection.taskIds, ...fromWorksets]);
  return [...ids].sort();
}

/**
 * Client filter for user_events against hierarchical source selection.
 *
 * - Selected `worksetIds` match **ownership** `event.worksetId` only.
 * - Explicit `taskIds` (not `expandWorksetIdsToTaskIds` members) may match
 *   provenance `taskId`. Workset expansion stays for analysis / RRULE fetch.
 */
export function userEventMatchesSourceSelection(
  event: { worksetId?: string | null; taskId?: string | null },
  allowWorksets: ReadonlySet<string>,
  allowExplicitTaskIds: ReadonlySet<string>,
): boolean {
  const rawWorkset =
    typeof event.worksetId === "string" ? event.worksetId.trim() : "";
  const worksetId = rawWorkset || SYSTEM_WORKSET_ID;
  if (allowWorksets.has(worksetId)) return true;
  const provenance = typeof event.taskId === "string" ? event.taskId.trim() : "";
  if (!provenance || isNullProvenanceTaskId(provenance)) return false;
  return allowExplicitTaskIds.has(provenance);
}

export type FilterTreeRow = {
  kind: "workset" | "unassigned";
  id: string;
  name: string;
  children: WorksetMemberTask[];
};

/** Synthetic group id for tasks with no workset (filter tree only). */
export const UNASSIGNED_FILTER_GROUP_ID = "__unassigned__";

/**
 * Workset-primary tree: every workset is a parent row (expandable when it has
 * members). Tasks always belong to a workset (omit / empty → 一般).
 */
export function buildFilterTreeRows(
  worksets: readonly { id: string; name: string }[],
  tasks: readonly WorksetMemberTask[],
  _unassignedLabel = "Unassigned",
): FilterTreeRow[] {
  const membersByWorkset = new Map<string, WorksetMemberTask[]>();
  for (const task of tasks) {
    const wid = task.worksetId?.trim() || SYSTEM_WORKSET_ID;
    const list = membersByWorkset.get(wid) ?? [];
    list.push(task);
    membersByWorkset.set(wid, list);
  }
  const rows: FilterTreeRow[] = [];
  for (const ws of worksets) {
    rows.push({
      kind: "workset",
      id: ws.id,
      name: ws.name,
      children: membersByWorkset.get(ws.id) ?? [],
    });
  }
  return rows;
}
