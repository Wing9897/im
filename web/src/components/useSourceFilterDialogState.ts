import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  resolveSourceFilterTaskLabel,
  type SourceFilterOption,
} from "../domain/timeline/sourceFilterOptions";
import {
  buildFilterTreeRows,
  isEmptySourceFilter,
  sourceFilterSelectedCount,
  type SourceFilterSelection,
  type WorksetMemberTask,
} from "../domain/tasks/sourceFilterSelection";
import {
  filterSourceFilterTreeRows,
  resolveCheckedTasks,
  resolveCheckedWorksets,
  sameSourceFilterSelection,
  toggleTaskInDraft,
  toggleWorksetInDraft,
} from "../domain/tasks/sourceFilterDialogDraft";
import { SYSTEM_WORKSET_ID } from "../types/worksets";
import { useGeneralWorksetLabel } from "../domain/timeline/useGeneralWorksetLabel";

export type WorksetFilterOption = {
  id: string;
  name: string;
  isSystem?: boolean;
};

export type SourceFilterExpandTask = {
  id: string;
  name?: string;
  worksetId?: string | null;
  analysisMode?: string | null;
};

export { sameSourceFilterSelection as sameSelection };

type Options = {
  tasks: SourceFilterOption[];
  worksets?: WorksetFilterOption[];
  expandTasks?: SourceFilterExpandTask[];
  selection: SourceFilterSelection;
  onChange: (next: SourceFilterSelection) => void;
};

/** Tree/state controller for SourceFilterDialog (presentation stays in the dialog). */
export function useSourceFilterDialogState({
  tasks,
  worksets = [],
  expandTasks,
  selection,
  onChange,
}: Options) {
  const { t } = useTranslation("common");
  const generalWorksetLabel = useGeneralWorksetLabel();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<SourceFilterSelection>(selection);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const memberTasks = useMemo((): WorksetMemberTask[] => {
    const catalogNameById = new Map(
      tasks.map((task) => [task.id, task.name] as const),
    );
    const rows: SourceFilterExpandTask[] =
      expandTasks ??
      tasks.map((task) => ({
        id: task.id,
        name: task.name,
        worksetId: (task as { worksetId?: string | null }).worksetId ?? null,
      }));
    return rows.map((task) => {
      const fromExpand = (task.name ?? "").trim();
      const fromCatalog = (catalogNameById.get(task.id) ?? "").trim();
      return {
        id: task.id,
        name: fromExpand || fromCatalog || undefined,
        worksetId: task.worksetId ?? null,
        analysisMode: task.analysisMode ?? null,
      };
    });
  }, [expandTasks, tasks]);

  const displayWorksets = useMemo(
    () =>
      worksets.map((ws) => ({
        ...ws,
        name: ws.id === SYSTEM_WORKSET_ID ? generalWorksetLabel : ws.name,
      })),
    [worksets, generalWorksetLabel],
  );

  useEffect(() => {
    if (!open) return;
    setDraft(selection);
    setQuery("");
  }, [open, selection]);

  const isFiltering = selection !== null;
  const selectedCount =
    selection === null
      ? displayWorksets.length +
        memberTasks.filter((task) => !task.worksetId).length
      : sourceFilterSelectedCount(selection);

  const checkedTasks = useMemo(
    () => resolveCheckedTasks(draft, memberTasks),
    [draft, memberTasks],
  );

  const checkedWorksets = useMemo(
    () => resolveCheckedWorksets(draft, displayWorksets.map((ws) => ws.id)),
    [draft, displayWorksets],
  );

  const treeRows = useMemo(
    () =>
      buildFilterTreeRows(displayWorksets, memberTasks, t("workset.unassignedGroup")),
    [displayWorksets, memberTasks, t],
  );

  const unnamedLabel = t("board.common.unnamedTask");

  const visibleRows = useMemo(() => {
    return filterSourceFilterTreeRows(treeRows, query, (child) => {
      const label = resolveSourceFilterTaskLabel(child.name, child.id, unnamedLabel);
      const rawName = (child.name ?? "").trim();
      return rawName && rawName !== label ? `${label} ${rawName}` : label;
    });
  }, [treeRows, query, unnamedLabel]);

  const allWorksetIds = useMemo(() => displayWorksets.map((ws) => ws.id), [displayWorksets]);

  const unassignedTaskIds = useMemo(
    () =>
      treeRows.find((row) => row.kind === "unassigned")?.children.map((child) => child.id) ?? [],
    [treeRows],
  );

  const draftCtx = useMemo(
    () => ({
      allWorksetIds,
      unassignedTaskIds,
      memberTasks,
    }),
    [allWorksetIds, unassignedTaskIds, memberTasks],
  );

  const toggleWorkset = (worksetId: string) => {
    setDraft((prev) => toggleWorksetInDraft(prev, worksetId, draftCtx));
  };

  const toggleTask = (taskId: string) => {
    setDraft((prev) => toggleTaskInDraft(prev, taskId, draftCtx));
  };

  const selectAll = () => setDraft(null);
  const clearAll = () => setDraft({ taskIds: [], worksetIds: [] });

  const apply = () => {
    onChange(draft);
    setOpen(false);
  };

  const toggleExpanded = (worksetId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(worksetId)) next.delete(worksetId);
      else next.add(worksetId);
      return next;
    });
  };

  return {
    open,
    setOpen,
    query,
    setQuery,
    draft,
    expanded,
    isFiltering,
    selectedCount,
    filterBadgeCount: isEmptySourceFilter(selection) ? 0 : selectedCount,
    checkedTasks,
    checkedWorksets,
    allSourcesSelected: draft === null,
    visibleRows,
    toggleWorkset,
    toggleTask,
    selectAll,
    clearAll,
    apply,
    toggleExpanded,
    applyDisabled: sameSourceFilterSelection(draft, selection),
  };
}
