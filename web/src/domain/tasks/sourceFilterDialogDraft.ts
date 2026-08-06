/**
 * Pure draft helpers for the hierarchical source-filter dialog.
 * Keeps workset-vs-task encoding rules out of React state glue.
 */

import {
  UNASSIGNED_FILTER_GROUP_ID,
  type FilterTreeRow,
  type SourceFilterSelection,
  type WorksetMemberTask,
} from "./sourceFilterSelection";

export type TriCheckState = "checked" | "unchecked" | "indeterminate";

export type SourceFilterDraftContext = {
  allWorksetIds: readonly string[];
  unassignedTaskIds: readonly string[];
  memberTasks: readonly WorksetMemberTask[];
};

/** Case-insensitive substring match for the filter search box. */
export function matchesSourceFilterQuery(name: string, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return true;
  return name.toLocaleLowerCase().includes(q);
}

/**
 * Which parent rows remain visible for the current search query.
 * Always returns rows with their **full** `children` list (check-state / counts
 * must not use a search-narrowed child set).
 */
export function filterSourceFilterTreeRows(
  rows: readonly FilterTreeRow[],
  query: string,
  taskSearchText: (child: WorksetMemberTask) => string,
): FilterTreeRow[] {
  const q = query.trim();
  if (!q) return [...rows];

  return rows.filter((row) => {
    if (matchesSourceFilterQuery(row.name, q)) return true;
    return row.children.some((child) =>
      matchesSourceFilterQuery(taskSearchText(child), q),
    );
  });
}

/**
 * Children to render under a visible row while searching.
 * - Parent name match → all children (so ▸ still reveals the full workset).
 * - Otherwise → only children whose search text matches.
 */
export function visibleChildrenForSourceFilterRow(
  row: FilterTreeRow,
  query: string,
  taskSearchText: (child: WorksetMemberTask) => string,
): WorksetMemberTask[] {
  const q = query.trim();
  if (!q) return row.children;
  if (matchesSourceFilterQuery(row.name, q)) return row.children;
  return row.children.filter((child) =>
    matchesSourceFilterQuery(taskSearchText(child), q),
  );
}

/** Collapse a complete “everything selected” draft to `null` (all sources). */
export function collapseSourceFilterDraft(
  next: { taskIds: string[]; worksetIds: string[] },
  ctx: Pick<SourceFilterDraftContext, "allWorksetIds" | "unassignedTaskIds">,
): SourceFilterSelection {
  const full: { taskIds: string[]; worksetIds: string[] } = {
    taskIds: [...next.taskIds].sort(),
    worksetIds: [...next.worksetIds].sort(),
  };
  const allWorksetsSelected =
    full.worksetIds.length === ctx.allWorksetIds.length &&
    ctx.allWorksetIds.every((id) => full.worksetIds.includes(id));
  const allUnassignedSelected = ctx.unassignedTaskIds.every((id) =>
    full.taskIds.includes(id),
  );
  // Only unassigned tasks live in taskIds when every workset is selected.
  const onlyUnassignedInTasks =
    full.taskIds.length === ctx.unassignedTaskIds.length && allUnassignedSelected;
  if (allWorksetsSelected && onlyUnassignedInTasks) {
    return null;
  }
  return full;
}

function memberIdsForWorkset(
  worksetId: string,
  memberTasks: readonly WorksetMemberTask[],
): Set<string> {
  return new Set(
    memberTasks.filter((task) => task.worksetId === worksetId).map((task) => task.id),
  );
}

/** Effective checked task ids for the current draft (incl. workset expansion). */
export function resolveCheckedTasks(
  draft: SourceFilterSelection,
  memberTasks: readonly WorksetMemberTask[],
): Set<string> {
  if (draft === null) return new Set(memberTasks.map((task) => task.id));
  const fromWorksets = new Set(
    memberTasks
      .filter((task) => task.worksetId && draft.worksetIds.includes(task.worksetId))
      .map((task) => task.id),
  );
  return new Set([...draft.taskIds, ...fromWorksets]);
}

export function resolveCheckedWorksets(
  draft: SourceFilterSelection,
  allWorksetIds: readonly string[],
): Set<string> {
  if (draft === null) return new Set(allWorksetIds);
  return new Set(draft.worksetIds);
}

/**
 * Parent row checkbox state.
 * Workset checked ⇔ workset id selected (items / workset-owned events).
 * Task-only coverage of members → indeterminate (not checked), matching help text.
 */
export function resolveGroupCheckState(opts: {
  kind: "workset" | "unassigned";
  worksetSelected: boolean;
  childIds: readonly string[];
  checkedTasks: ReadonlySet<string>;
  allSourcesSelected: boolean;
}): TriCheckState {
  if (opts.allSourcesSelected) return "checked";
  if (opts.kind === "workset") {
    if (opts.worksetSelected) return "checked";
    const selectedCount = opts.childIds.filter((id) => opts.checkedTasks.has(id)).length;
    if (selectedCount === 0) return "unchecked";
    return "indeterminate";
  }
  if (opts.childIds.length === 0) return "unchecked";
  const selectedCount = opts.childIds.filter((id) => opts.checkedTasks.has(id)).length;
  if (selectedCount === 0) return "unchecked";
  if (selectedCount === opts.childIds.length) return "checked";
  return "indeterminate";
}

export function toggleWorksetInDraft(
  draft: SourceFilterSelection,
  worksetId: string,
  ctx: SourceFilterDraftContext,
): SourceFilterSelection {
  const checkedTasks = resolveCheckedTasks(draft, ctx.memberTasks);

  if (worksetId === UNASSIGNED_FILTER_GROUP_ID) {
    const allOn =
      ctx.unassignedTaskIds.length > 0 &&
      ctx.unassignedTaskIds.every((id) => checkedTasks.has(id));
    if (draft === null) {
      // Deselect unassigned only: keep all real worksets.
      return collapseSourceFilterDraft(
        { taskIds: [], worksetIds: [...ctx.allWorksetIds] },
        ctx,
      );
    }
    const nextTasks = new Set(draft.taskIds);
    if (allOn) {
      for (const id of ctx.unassignedTaskIds) nextTasks.delete(id);
    } else {
      for (const id of ctx.unassignedTaskIds) nextTasks.add(id);
    }
    return collapseSourceFilterDraft(
      { taskIds: [...nextTasks], worksetIds: draft.worksetIds },
      ctx,
    );
  }

  if (draft === null) {
    return collapseSourceFilterDraft(
      {
        taskIds: [...ctx.unassignedTaskIds],
        worksetIds: ctx.allWorksetIds.filter((id) => id !== worksetId),
      },
      ctx,
    );
  }

  const next = new Set(draft.worksetIds);
  if (next.has(worksetId)) next.delete(worksetId);
  else next.add(worksetId);
  // Drop explicit member taskIds covered by the workset id.
  const memberIds = memberIdsForWorkset(worksetId, ctx.memberTasks);
  const nextTasks = draft.taskIds.filter((id) => !memberIds.has(id));
  return collapseSourceFilterDraft(
    { taskIds: nextTasks, worksetIds: [...next] },
    ctx,
  );
}

export function toggleTaskInDraft(
  draft: SourceFilterSelection,
  taskId: string,
  ctx: SourceFilterDraftContext,
): SourceFilterSelection {
  const parent = ctx.memberTasks.find((task) => task.id === taskId);
  const parentWorksetId = parent?.worksetId ?? null;

  if (draft === null) {
    if (parentWorksetId) {
      // Split parent workset into sibling task ids (minus this one) + remaining worksets.
      const siblings = ctx.memberTasks
        .filter((task) => task.worksetId === parentWorksetId && task.id !== taskId)
        .map((task) => task.id);
      return collapseSourceFilterDraft(
        {
          taskIds: [...ctx.unassignedTaskIds, ...siblings],
          worksetIds: ctx.allWorksetIds.filter((id) => id !== parentWorksetId),
        },
        ctx,
      );
    }
    return collapseSourceFilterDraft(
      {
        taskIds: ctx.unassignedTaskIds.filter((id) => id !== taskId),
        worksetIds: [...ctx.allWorksetIds],
      },
      ctx,
    );
  }

  // Member under a selected workset: convert workset → siblings ± this task.
  if (parentWorksetId && draft.worksetIds.includes(parentWorksetId)) {
    const siblings = ctx.memberTasks
      .filter((task) => task.worksetId === parentWorksetId)
      .map((task) => task.id);
    const nextTasks = new Set(draft.taskIds);
    for (const id of siblings) {
      if (id === taskId) nextTasks.delete(id);
      else nextTasks.add(id);
    }
    return collapseSourceFilterDraft(
      {
        taskIds: [...nextTasks],
        worksetIds: draft.worksetIds.filter((id) => id !== parentWorksetId),
      },
      ctx,
    );
  }

  const next = new Set(draft.taskIds);
  if (next.has(taskId)) next.delete(taskId);
  else next.add(taskId);
  return collapseSourceFilterDraft(
    { taskIds: [...next], worksetIds: draft.worksetIds },
    ctx,
  );
}

export function sameSourceFilterSelection(
  a: SourceFilterSelection,
  b: SourceFilterSelection,
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a.taskIds.length !== b.taskIds.length || a.worksetIds.length !== b.worksetIds.length) {
    return false;
  }
  const tasksA = [...a.taskIds].sort();
  const tasksB = [...b.taskIds].sort();
  const wsA = [...a.worksetIds].sort();
  const wsB = [...b.worksetIds].sort();
  return tasksA.every((id, i) => id === tasksB[i]) && wsA.every((id, i) => id === wsB[i]);
}
