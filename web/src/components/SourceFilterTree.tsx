/**
 * Hierarchical workset/task checklist used inside SourceFilterDialog.
 * Worksets are primary rows; member tasks nest under a chevron expand control.
 */

import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { TextField } from "./ui";
import type { FilterTreeRow } from "../domain/tasks/sourceFilterSelection";
import { resolveSourceFilterTaskLabel } from "../domain/timeline/sourceFilterOptions";
import { formatAnalysisMode } from "../utils/analysis";

export function matchesSourceFilterQuery(name: string, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return true;
  return name.toLocaleLowerCase().includes(q);
}

type SourceFilterTreeProps = {
  rows: FilterTreeRow[];
  query: string;
  onQueryChange: (query: string) => void;
  expanded: ReadonlySet<string>;
  onToggleExpanded: (worksetId: string) => void;
  checkedTasks: ReadonlySet<string>;
  checkedWorksets: ReadonlySet<string>;
  onToggleTask: (taskId: string) => void;
  onToggleWorkset: (worksetId: string) => void;
};

function taskSearchText(
  child: { id: string; name?: string },
  unnamedLabel: string,
): string {
  const label = resolveSourceFilterTaskLabel(child.name, child.id, unnamedLabel);
  const rawName = (child.name ?? "").trim();
  return rawName && rawName !== label ? `${label} ${rawName}` : label;
}

/** Search box + expandable workset-primary checkbox tree. */
export function SourceFilterTree({
  rows,
  query,
  onQueryChange,
  expanded,
  onToggleExpanded,
  checkedTasks,
  checkedWorksets,
  onToggleTask,
  onToggleWorkset,
}: SourceFilterTreeProps) {
  const { t } = useTranslation("common");
  const searching = Boolean(query.trim());
  const unnamedLabel = t("board.common.unnamedTask");
  const recurringBadge = t("workset.filterRecurringBadge");

  return (
    <div className="flex flex-col gap-md">
      <p className="m-0 text-caption text-text-muted">{t("workset.filterHint")}</p>
      <TextField
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={t("workset.filterSearchPlaceholder")}
        aria-label={t("workset.filterSearchPlaceholder")}
        data-testid="source-filter-dialog-search"
      />
      <ul
        className="m-0 flex max-h-[44vh] list-none flex-col gap-1.5 overflow-auto p-0"
        aria-label={t("workset.filterBrowseAria")}
      >
        {rows.map((row) => {
          const childCount = row.children.length;
          const canExpand = childCount > 0;
          const isOpen = canExpand && (expanded.has(row.id) || searching);
          const groupChecked =
            row.kind === "unassigned"
              ? childCount > 0 && row.children.every((child) => checkedTasks.has(child.id))
              : checkedWorksets.has(row.id);
          const visibleChildren = searching
            ? row.children.filter((child) =>
                matchesSourceFilterQuery(taskSearchText(child, unnamedLabel), query),
              )
            : row.children;
          const isUnassigned = row.kind === "unassigned";

          return (
            <li
              key={`${row.kind}-${row.id}`}
              className={[
                "overflow-hidden rounded-md border",
                isUnassigned
                  ? "border-dashed border-surface-border/80 bg-[color-mix(in_srgb,var(--surface-raised)_40%,transparent)]"
                  : "border-surface-border/70 bg-[color-mix(in_srgb,var(--surface-card)_70%,transparent)]",
              ].join(" ")}
            >
              <div className="flex items-center gap-1 px-1.5 py-1.5">
                <button
                  type="button"
                  className={[
                    "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-text-muted transition-transform duration-150",
                    canExpand ? "hover:bg-surface-raised hover:text-text-primary" : "opacity-30",
                    isOpen ? "rotate-90" : "",
                  ].join(" ")}
                  aria-expanded={canExpand ? isOpen : undefined}
                  aria-label={t("workset.expandWorksetAria", { name: row.name })}
                  data-testid={`board-workset-expand-${row.id}`}
                  onClick={() => onToggleExpanded(row.id)}
                  disabled={!canExpand}
                >
                  <ChevronRight size={16} strokeWidth={2.25} aria-hidden="true" />
                </button>
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-sm pr-sm">
                  <input
                    type="checkbox"
                    checked={groupChecked}
                    data-testid={`board-workset-filter-${row.id}`}
                    onChange={() => onToggleWorkset(row.id)}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                    {row.name}
                  </span>
                  <span className="shrink-0 text-caption text-text-muted">
                    {t("workset.filterChildCount", { count: childCount })}
                  </span>
                </label>
              </div>
              {isOpen && visibleChildren.length > 0 ? (
                <ul className="m-0 list-none border-t border-surface-border/60 bg-[color-mix(in_srgb,var(--surface-raised)_55%,transparent)] p-0">
                  {visibleChildren.map((child) => {
                    const label = resolveSourceFilterTaskLabel(
                      child.name,
                      child.id,
                      unnamedLabel,
                    );
                    const isRecurring = child.analysisMode === "recurring";
                    const modeBadge = isRecurring
                      ? recurringBadge
                      : child.analysisMode
                        ? formatAnalysisMode(child.analysisMode)
                        : null;
                    return (
                      <li key={child.id}>
                        <label className="flex cursor-pointer items-center gap-sm border-l-2 border-l-accent/35 py-1.5 pl-9 pr-sm hover:bg-surface-raised">
                          <input
                            type="checkbox"
                            checked={checkedTasks.has(child.id)}
                            data-testid={`board-source-filter-${child.id}`}
                            onChange={() => onToggleTask(child.id)}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                            {label}
                          </span>
                          {modeBadge ? (
                            <span
                              className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium tracking-wide text-text-muted ring-1 ring-inset ring-surface-border/80"
                              data-testid={
                                isRecurring
                                  ? `source-filter-recurring-${child.id}`
                                  : `source-filter-mode-${child.id}`
                              }
                            >
                              {modeBadge}
                            </span>
                          ) : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-text-muted">{t("workset.emptyList")}</p>
      ) : null}
    </div>
  );
}
