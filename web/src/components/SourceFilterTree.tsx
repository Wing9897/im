/**
 * Hierarchical workset/task checklist used inside SourceFilterDialog.
 * Worksets are primary rows; member tasks nest under a chevron expand control.
 *
 * Selection mutation lives in `sourceFilterDialogDraft` / the dialog state hook —
 * this file is presentational (search box + tree + tri-state checkboxes).
 * Timeline dual-column chrome (heading + select/clear + scroll) is
 * `SourceFilterColumnShell`; board/intelligence keep the single-tree dialog.
 */

import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button, TextField } from "./ui";
import { TriStateCheckbox } from "./TriStateCheckbox";
import type { FilterTreeRow } from "../domain/tasks/sourceFilterSelection";
import {
  resolveGroupCheckState,
  visibleChildrenForSourceFilterRow,
} from "../domain/tasks/sourceFilterDialogDraft";
import { resolveSourceFilterTaskLabel } from "../domain/timeline/sourceFilterOptions";
import { formatAnalysisMode } from "../utils/analysis";

export { matchesSourceFilterQuery } from "../domain/tasks/sourceFilterDialogDraft";

type SourceFilterTreeProps = {
  rows: FilterTreeRow[];
  query: string;
  onQueryChange: (query: string) => void;
  expanded: ReadonlySet<string>;
  onToggleExpanded: (worksetId: string) => void;
  checkedTasks: ReadonlySet<string>;
  checkedWorksets: ReadonlySet<string>;
  allSourcesSelected: boolean;
  onToggleTask: (taskId: string) => void;
  onToggleWorkset: (worksetId: string) => void;
  /** Timeline owns a shared hint + search above 本機 / 訂閱 columns. */
  hideHint?: boolean;
  hideSearch?: boolean;
  /** Column wrapper scrolls; skip the inner max-height list scroller. */
  embedded?: boolean;
};

/** Column identity: icon mark with localized name (sr-only + title), not a selectable row. */
export function SourceFilterSectionHeading({
  icon: Icon,
  label,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  testId?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-sm" data-testid={testId} role="presentation">
      <span
        className="h-px min-w-4 flex-1 bg-[color-mix(in_srgb,var(--text-primary)_18%,var(--surface-border))]"
        aria-hidden="true"
      />
      <h3 className="m-0 inline-flex shrink-0 items-center text-text-secondary" title={label}>
        <Icon size={16} strokeWidth={2.5} aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </h3>
      <span
        className="h-px min-w-4 flex-1 bg-[color-mix(in_srgb,var(--text-primary)_18%,var(--surface-border))]"
        aria-hidden="true"
      />
    </div>
  );
}

const COLUMN_SCROLL_CLASS =
  "im-auto-scrollbar min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]";

/** Timeline 本機 / 訂閱 column: heading + select/clear + independently scrolling list. */
export function SourceFilterColumnShell({
  icon,
  label,
  headingTestId,
  sectionTestId,
  scrollTestId,
  selectLabel,
  clearLabel,
  selectAria,
  clearAria,
  onSelectAll,
  onClearAll,
  selectTestId,
  clearTestId,
  disabled = false,
  actionsClassName,
  scrollClassName,
  beforeActions,
  dataAvailability,
  children,
}: {
  icon: LucideIcon;
  label: string;
  headingTestId: string;
  sectionTestId: string;
  scrollTestId: string;
  selectLabel: string;
  clearLabel: string;
  selectAria: string;
  clearAria: string;
  onSelectAll: () => void;
  onClearAll: () => void;
  selectTestId: string;
  clearTestId: string;
  disabled?: boolean;
  actionsClassName?: string;
  scrollClassName?: string;
  beforeActions?: ReactNode;
  dataAvailability?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-sm overflow-hidden"
      data-testid={sectionTestId}
      data-availability={dataAvailability}
      aria-label={label}
      aria-disabled={disabled || undefined}
    >
      <SourceFilterSectionHeading icon={icon} label={label} testId={headingTestId} />
      {beforeActions}
      <div className={actionsClassName}>
        <SourceFilterColumnActions
          selectLabel={selectLabel}
          clearLabel={clearLabel}
          selectAria={selectAria}
          clearAria={clearAria}
          onSelectAll={onSelectAll}
          onClearAll={onClearAll}
          selectTestId={selectTestId}
          clearTestId={clearTestId}
          disabled={disabled}
        />
      </div>
      <div
        className={scrollClassName ? `${COLUMN_SCROLL_CLASS} ${scrollClassName}` : COLUMN_SCROLL_CLASS}
        data-testid={scrollTestId}
      >
        {children}
      </div>
    </section>
  );
}

/** Per-column select/clear. Visible labels may match; aria-label must be unique. */
export function SourceFilterColumnActions({
  selectLabel,
  clearLabel,
  selectAria,
  clearAria,
  onSelectAll,
  onClearAll,
  selectTestId,
  clearTestId,
  disabled = false,
}: {
  selectLabel: string;
  clearLabel: string;
  selectAria: string;
  clearAria: string;
  onSelectAll: () => void;
  onClearAll: () => void;
  selectTestId: string;
  clearTestId: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-wrap gap-sm px-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onSelectAll}
        aria-label={selectAria}
        data-testid={selectTestId}
        disabled={disabled}
      >
        {selectLabel}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onClearAll}
        aria-label={clearAria}
        data-testid={clearTestId}
        disabled={disabled}
      >
        {clearLabel}
      </Button>
    </div>
  );
}

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
  allSourcesSelected,
  onToggleTask,
  onToggleWorkset,
  hideHint = false,
  hideSearch = false,
  embedded = false,
}: SourceFilterTreeProps) {
  const { t } = useTranslation("common");
  const searching = Boolean(query.trim());
  const unnamedLabel = t("board:common.unnamedTask");
  const listClass = embedded
    ? "m-0 flex list-none flex-col gap-1.5 p-0"
    : "im-auto-scrollbar m-0 flex max-h-[44vh] list-none flex-col gap-1.5 overflow-auto p-0 [scrollbar-gutter:stable]";

  return (
    <div className="flex flex-col gap-md">
      {hideHint ? null : (
        <p className="m-0 text-caption leading-relaxed text-text-secondary">
          {t("workset:filterHint")}
        </p>
      )}
      {hideSearch ? null : (
        <TextField
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("workset:filterSearchPlaceholder")}
          aria-label={t("workset:filterSearchPlaceholder")}
          data-testid="source-filter-dialog-search"
          className="im-surface-inset border-[color-mix(in_srgb,var(--text-primary)_28%,var(--surface-border))] placeholder:text-text-secondary/80"
        />
      )}
      <ul className={listClass} aria-label={t("workset:filterBrowseAria")}>
        {rows.map((row) => {
          const childCount = row.children.length;
          const canExpand = childCount > 0;
          const isOpen = canExpand && (expanded.has(row.id) || searching);
          const visibleChildren = visibleChildrenForSourceFilterRow(row, query, (child) =>
            taskSearchText(child, unnamedLabel),
          );
          const groupState = resolveGroupCheckState({
            kind: row.kind,
            worksetSelected: checkedWorksets.has(row.id),
            childIds: row.children.map((child) => child.id),
            checkedTasks,
            allSourcesSelected,
          });

          return (
            <li
              key={`${row.kind}-${row.id}`}
              className="overflow-hidden rounded-md border outline-none im-surface-inset border-[color-mix(in_srgb,var(--text-primary)_26%,var(--surface-border))]"
            >
              <div className="flex items-center gap-1 px-1.5 py-1.5">
                <button
                  type="button"
                  className={[
                    "inline-flex size-7 shrink-0 items-center justify-center rounded-md border-0 bg-transparent",
                    "shadow-none outline-none",
                    "transition-[transform,color] duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)]",
                    canExpand
                      ? "text-text-secondary hover:text-text-primary"
                      : "invisible",
                    isOpen ? "rotate-90" : "",
                  ].join(" ")}
                  aria-expanded={canExpand ? isOpen : undefined}
                  aria-label={t("workset:expandWorksetAria", { name: row.name })}
                  data-testid={`board-workset-expand-${row.id}`}
                  onClick={() => onToggleExpanded(row.id)}
                  disabled={!canExpand}
                >
                  <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" />
                </button>
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-sm pr-sm">
                  <TriStateCheckbox
                    state={groupState}
                    testId={`board-workset-filter-${row.id}`}
                    onChange={() => onToggleWorkset(row.id)}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                    {row.name}
                  </span>
                  <span className="shrink-0 rounded-md bg-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] px-1.5 py-0.5 text-caption font-semibold tabular-nums text-text-secondary">
                    {t("workset:filterChildCount", { count: childCount })}
                  </span>
                </label>
              </div>
              {isOpen && visibleChildren.length > 0 ? (
                <ul className="m-0 list-none border-t border-[color-mix(in_srgb,var(--text-primary)_20%,var(--surface-border))] bg-[color-mix(in_srgb,var(--surface-card)_55%,transparent)] p-0">
                  {visibleChildren.map((child) => {
                    const label = resolveSourceFilterTaskLabel(
                      child.name,
                      child.id,
                      unnamedLabel,
                    );
                    const modeBadge = child.analysisMode
                      ? formatAnalysisMode(child.analysisMode)
                      : null;
                    return (
                      <li key={child.id}>
                        <label className="flex cursor-pointer items-center gap-sm border-l-2 border-l-accent/55 py-1.5 pl-9 pr-sm hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)]">
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
                              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-text-secondary ring-1 ring-inset ring-[color-mix(in_srgb,var(--text-primary)_28%,var(--surface-border))]"
                              data-testid={`source-filter-mode-${child.id}`}
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
        <p className="m-0 text-sm text-text-secondary">{t("workset:emptyList")}</p>
      ) : null}
    </div>
  );
}
