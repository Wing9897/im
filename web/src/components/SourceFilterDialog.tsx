import { ListFilter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ModalDialog } from "./ModalDialog";
import { matchesSourceFilterQuery, SourceFilterTree } from "./SourceFilterTree";
import { Button, PillButton } from "./ui";
import {
  resolveSourceFilterTaskLabel,
  type SourceFilterOption,
} from "../domain/timeline/sourceFilterOptions";
import {
  buildFilterTreeRows,
  isEmptySourceFilter,
  sourceFilterSelectedCount,
  UNASSIGNED_FILTER_GROUP_ID,
  type SourceFilterSelection,
  type WorksetMemberTask,
} from "../domain/tasks/sourceFilterSelection";
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

interface SourceFilterDialogProps {
  tasks: SourceFilterOption[];
  worksets?: WorksetFilterOption[];
  /** Tasks used to place children under worksets (may include all catalog tasks). */
  expandTasks?: SourceFilterExpandTask[];
  /** `null` = all sources. */
  selection: SourceFilterSelection;
  onChange: (next: SourceFilterSelection) => void;
  ariaLabelPrefix?: string;
  variant?: "board" | "toolbar";
}

function sameSelection(a: SourceFilterSelection, b: SourceFilterSelection): boolean {
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

/**
 * Toolbar filter trigger + modal: hierarchical workset/task tree multi-select.
 */
export function SourceFilterDialog({
  tasks,
  worksets = [],
  expandTasks,
  selection,
  onChange,
  ariaLabelPrefix,
  variant = "toolbar",
}: SourceFilterDialogProps) {
  const { t } = useTranslation("common");
  const generalWorksetLabel = useGeneralWorksetLabel();
  const prefix = ariaLabelPrefix ?? t("board.shell.sourceFilterPrefix");
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

  const checkedTasks = useMemo(() => {
    if (draft === null) return new Set(memberTasks.map((task) => task.id));
    const fromWorksets = new Set(
      memberTasks
        .filter((task) => task.worksetId && draft.worksetIds.includes(task.worksetId))
        .map((task) => task.id),
    );
    return new Set([...draft.taskIds, ...fromWorksets]);
  }, [draft, memberTasks]);

  const checkedWorksets = useMemo(() => {
    if (draft === null) return new Set(displayWorksets.map((ws) => ws.id));
    return new Set(draft.worksetIds);
  }, [draft, displayWorksets]);

  const treeRows = useMemo(
    () =>
      buildFilterTreeRows(displayWorksets, memberTasks, t("workset.unassignedGroup")),
    [displayWorksets, memberTasks, t],
  );

  const unnamedLabel = t("board.common.unnamedTask");

  const visibleRows = useMemo(() => {
    const q = query.trim();
    if (!q) return treeRows;
    return treeRows.filter((row) => {
      if (matchesSourceFilterQuery(row.name, q)) return true;
      return row.children.some((child) => {
        const label = resolveSourceFilterTaskLabel(child.name, child.id, unnamedLabel);
        const rawName = (child.name ?? "").trim();
        return (
          matchesSourceFilterQuery(label, q) ||
          (rawName ? matchesSourceFilterQuery(rawName, q) : false)
        );
      });
    });
  }, [treeRows, query, unnamedLabel]);

  const allWorksetIds = useMemo(() => displayWorksets.map((ws) => ws.id), [displayWorksets]);

  const unassignedTaskIds = useMemo(
    () =>
      treeRows.find((row) => row.kind === "unassigned")?.children.map((child) => child.id) ?? [],
    [treeRows],
  );

  const collapseOrSet = (next: { taskIds: string[]; worksetIds: string[] }) => {
    const full: SourceFilterSelection = {
      taskIds: [...next.taskIds].sort(),
      worksetIds: [...next.worksetIds].sort(),
    };
    const allWorksetsSelected =
      full.worksetIds.length === allWorksetIds.length &&
      allWorksetIds.every((id) => full.worksetIds.includes(id));
    const allUnassignedSelected = unassignedTaskIds.every((id) => full.taskIds.includes(id));
    // Only unassigned tasks live in taskIds when every workset is selected.
    const onlyUnassignedInTasks =
      full.taskIds.length === unassignedTaskIds.length && allUnassignedSelected;
    if (allWorksetsSelected && onlyUnassignedInTasks) {
      setDraft(null);
      return;
    }
    setDraft(full);
  };

  const toggleWorkset = (worksetId: string) => {
    if (worksetId === UNASSIGNED_FILTER_GROUP_ID) {
      const allOn =
        unassignedTaskIds.length > 0 &&
        unassignedTaskIds.every((id) => checkedTasks.has(id));
      if (draft === null) {
        // Deselect unassigned only: keep all real worksets.
        collapseOrSet({ taskIds: [], worksetIds: allWorksetIds });
        return;
      }
      const nextTasks = new Set(draft.taskIds);
      if (allOn) {
        for (const id of unassignedTaskIds) nextTasks.delete(id);
      } else {
        for (const id of unassignedTaskIds) nextTasks.add(id);
      }
      collapseOrSet({ taskIds: [...nextTasks], worksetIds: draft.worksetIds });
      return;
    }

    if (draft === null) {
      collapseOrSet({
        taskIds: unassignedTaskIds,
        worksetIds: allWorksetIds.filter((id) => id !== worksetId),
      });
      return;
    }
    const next = new Set(draft.worksetIds);
    if (next.has(worksetId)) next.delete(worksetId);
    else next.add(worksetId);
    // Drop explicit member taskIds that belong to this workset (covered by workset id).
    const memberIds = new Set(
      memberTasks.filter((task) => task.worksetId === worksetId).map((task) => task.id),
    );
    const nextTasks = draft.taskIds.filter((id) => !memberIds.has(id));
    collapseOrSet({ taskIds: nextTasks, worksetIds: [...next] });
  };

  const toggleTask = (taskId: string) => {
    const parent = memberTasks.find((task) => task.id === taskId);
    const parentWorksetId = parent?.worksetId ?? null;

    if (draft === null) {
      if (parentWorksetId) {
        // Split parent workset into sibling task ids (minus this one) + remaining worksets.
        const siblings = memberTasks
          .filter((task) => task.worksetId === parentWorksetId && task.id !== taskId)
          .map((task) => task.id);
        collapseOrSet({
          taskIds: [...unassignedTaskIds, ...siblings],
          worksetIds: allWorksetIds.filter((id) => id !== parentWorksetId),
        });
        return;
      }
      collapseOrSet({
        taskIds: unassignedTaskIds.filter((id) => id !== taskId),
        worksetIds: allWorksetIds,
      });
      return;
    }

    // Member under a selected workset: convert workset → siblings ± this task.
    if (parentWorksetId && draft.worksetIds.includes(parentWorksetId)) {
      const siblings = memberTasks
        .filter((task) => task.worksetId === parentWorksetId)
        .map((task) => task.id);
      const nextTasks = new Set(draft.taskIds);
      for (const id of siblings) {
        if (id === taskId) nextTasks.delete(id);
        else nextTasks.add(id);
      }
      collapseOrSet({
        taskIds: [...nextTasks],
        worksetIds: draft.worksetIds.filter((id) => id !== parentWorksetId),
      });
      return;
    }

    const next = new Set(draft.taskIds);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    collapseOrSet({ taskIds: [...next], worksetIds: draft.worksetIds });
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

  return (
    <>
      <PillButton
        active={open || isFiltering}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-pressed={isFiltering}
        aria-label={t("board.shell.sourceFilterSelectAria", { prefix })}
        title={t("board.shell.sourceFilterSelect")}
        onClick={() => setOpen(true)}
        className={variant === "toolbar" ? "relative" : "relative size-8 p-0"}
        data-testid="board-source-filter"
      >
        <ListFilter size={16} strokeWidth={2.5} aria-hidden="true" />
        {isFiltering ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-0.5 text-[10px] font-semibold text-white"
            aria-hidden="true"
            data-testid="board-source-filter-count"
          >
            {isEmptySourceFilter(selection) ? 0 : selectedCount}
          </span>
        ) : null}
      </PillButton>

      <ModalDialog
        open={open}
        title={t("workset.filterTitle")}
        closeAriaLabel={t("dialog.close")}
        onClose={() => setOpen(false)}
        testId="source-filter-dialog"
        size="wide"
        footerJustify="space-between"
        footer={
          <>
            <div className="flex gap-sm">
              <Button type="button" variant="secondary" onClick={selectAll}>
                {t("workset.selectAll")}
              </Button>
              <Button type="button" variant="secondary" onClick={clearAll}>
                {t("workset.clearAll")}
              </Button>
            </div>
            <Button
              type="button"
              variant="primary"
              onClick={apply}
              disabled={sameSelection(draft, selection)}
            >
              {t("workset.apply")}
            </Button>
          </>
        }
      >
        <SourceFilterTree
          rows={visibleRows}
          query={query}
          onQueryChange={setQuery}
          expanded={expanded}
          onToggleExpanded={toggleExpanded}
          checkedTasks={checkedTasks}
          checkedWorksets={checkedWorksets}
          onToggleTask={toggleTask}
          onToggleWorkset={toggleWorkset}
        />
      </ModalDialog>
    </>
  );
}
