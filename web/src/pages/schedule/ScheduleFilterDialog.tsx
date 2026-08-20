import type { TFunction } from "i18next";
import { Filter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ModalDialog } from "../../components/ModalDialog";
import {
  Button,
  FieldLabel,
  FilterChip,
  PillButton,
  TextField,
} from "../../components/ui";
import type { Workset } from "../../types/worksets";
import {
  countActiveScheduleFilters,
  DEFAULT_SCHEDULE_FILTERS,
  type ScheduleListFilters,
  type ScheduleTypeFilter,
} from "./scheduleFilters";

const TYPE_FILTERS: Array<[ScheduleTypeFilter, string]> = [
  ["all", "filter.typeAll"],
  ["oneOff", "filter.typeOneOff"],
  ["recurring", "filter.typeRecurring"],
];

const worksetOptionClass =
  "inline-flex min-h-7 w-full cursor-pointer items-center rounded-md border px-2 text-left text-caption font-medium transition-[background,color,border-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)]";
const worksetOptionActiveClass =
  "border-[color-mix(in_srgb,var(--accent)_45%,var(--surface-border))] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent";
const worksetOptionIdleClass =
  "border-transparent text-text-primary hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)]";

interface ScheduleFilterDialogProps {
  t: TFunction;
  filters: ScheduleListFilters;
  onFiltersChange: (next: ScheduleListFilters) => void;
  worksets: readonly Workset[];
}

function matchesWorksetQuery(label: string, query: string): boolean {
  if (!query) return true;
  return label.toLocaleLowerCase().includes(query);
}

/**
 * Compact Filter icon + modal: type, searchable workset list, date range.
 * Live-applies like monitor FilterBar (Done closes; session key lives on the page).
 */
export function ScheduleFilterDialog({
  t,
  filters,
  onFiltersChange,
  worksets,
}: ScheduleFilterDialogProps) {
  const [open, setOpen] = useState(false);
  const [worksetQuery, setWorksetQuery] = useState("");
  const activeCount = countActiveScheduleFilters(filters);
  const hasActiveFilters = activeCount > 0;

  useEffect(() => {
    if (!open) setWorksetQuery("");
  }, [open]);

  const worksetRows = useMemo(() => {
    const query = worksetQuery.trim().toLocaleLowerCase();
    const allLabel = t("filter.worksetAll");
    const rows: Array<{ value: string; label: string }> = [];
    if (matchesWorksetQuery(allLabel, query)) {
      rows.push({ value: "", label: allLabel });
    }
    for (const workset of worksets) {
      if (matchesWorksetQuery(workset.name, query)) {
        rows.push({ value: workset.id, label: workset.name });
      }
    }
    return rows;
  }, [t, worksetQuery, worksets]);

  return (
    <>
      <PillButton
        padding="square"
        active={hasActiveFilters || open}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-pressed={hasActiveFilters}
        aria-label={
          hasActiveFilters
            ? t("filter.openAriaActive", { count: activeCount })
            : t("filter.openAria")
        }
        title={t("filter.title")}
        onClick={() => setOpen(true)}
        className="relative shrink-0"
        data-testid="schedule-filter-trigger"
      >
        <Filter size={16} strokeWidth={2.5} aria-hidden="true" />
        {hasActiveFilters ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-0.5 text-[10px] font-semibold text-white"
            aria-hidden="true"
            data-testid="schedule-filter-badge"
          >
            {activeCount}
          </span>
        ) : null}
      </PillButton>

      <ModalDialog
        open={open}
        title={t("filter.dialogTitle")}
        closeAriaLabel={t("filter.dialogCloseAria")}
        onClose={() => setOpen(false)}
        testId="schedule-filter-dialog"
        size="wide"
        bodyClassName="flex min-h-0 flex-col overflow-hidden"
        footerJustify="space-between"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onFiltersChange({ ...DEFAULT_SCHEDULE_FILTERS })}
              disabled={!hasActiveFilters}
              className={!hasActiveFilters ? "invisible" : undefined}
              aria-hidden={!hasActiveFilters ? true : undefined}
              tabIndex={!hasActiveFilters ? -1 : undefined}
              aria-label={t("filter.clearAria")}
              data-testid="schedule-filters-clear"
            >
              {t("filter.clear")}
            </Button>
            <Button type="button" variant="primary" onClick={() => setOpen(false)}>
              {t("filter.done")}
            </Button>
          </>
        }
      >
        <div className="im-filter-panel" data-testid="schedule-filter-panel">
          <div>
            <FieldLabel className="mb-1">{t("filter.typeAria")}</FieldLabel>
            <div
              className="flex flex-wrap items-center gap-1"
              role="group"
              aria-label={t("filter.typeAria")}
              data-testid="schedule-type-filter"
            >
              {TYPE_FILTERS.map(([key, labelKey]) => (
                <FilterChip
                  key={key}
                  size="sm"
                  active={filters.type === key}
                  data-testid={`schedule-type-filter-${key}`}
                  onClick={() => onFiltersChange({ ...filters, type: key })}
                >
                  {t(labelKey)}
                </FilterChip>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel className="mb-1" htmlFor="schedule-workset-search">
              {t("filter.worksetAria")}
            </FieldLabel>
            <TextField
              id="schedule-workset-search"
              type="search"
              value={worksetQuery}
              onChange={(event) => setWorksetQuery(event.target.value)}
              placeholder={t("filter.worksetSearchPlaceholder")}
              aria-label={t("filter.worksetSearchAria")}
              data-testid="schedule-workset-search"
            />
            <ul
              className="im-auto-scrollbar mt-2 m-0 flex max-h-52 list-none flex-col gap-0.5 overflow-auto p-0 [scrollbar-gutter:stable]"
              role="listbox"
              aria-label={t("filter.worksetAria")}
              data-testid="schedule-workset-filter"
            >
              {worksetRows.length === 0 ? (
                <li className="px-2 py-1 text-caption text-text-muted">{t("filter.worksetEmpty")}</li>
              ) : (
                worksetRows.map((row) => {
                  const selected = filters.worksetId === row.value;
                  return (
                    <li key={row.value || "all"}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`${worksetOptionClass} ${
                          selected ? worksetOptionActiveClass : worksetOptionIdleClass
                        }`}
                        data-testid={
                          row.value
                            ? `schedule-workset-option-${row.value}`
                            : "schedule-workset-option-all"
                        }
                        onClick={() => onFiltersChange({ ...filters, worksetId: row.value })}
                      >
                        <span className="min-w-0 truncate">{row.label}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <div>
            <FieldLabel className="mb-1">{t("filter.dateRange")}</FieldLabel>
            <div
              className="im-filter-panel-row"
              role="group"
              aria-label={t("filter.dateRange")}
            >
              <div className="im-filter-panel-field">
                <TextField
                  type="date"
                  value={filters.startDay}
                  onChange={(event) =>
                    onFiltersChange({ ...filters, startDay: event.target.value })
                  }
                  aria-label={t("filter.dateFromAria")}
                  data-testid="schedule-date-from"
                />
              </div>
              <div className="im-filter-panel-field">
                <TextField
                  type="date"
                  value={filters.endDay}
                  onChange={(event) =>
                    onFiltersChange({ ...filters, endDay: event.target.value })
                  }
                  aria-label={t("filter.dateToAria")}
                  data-testid="schedule-date-to"
                />
              </div>
            </div>
          </div>
        </div>
      </ModalDialog>
    </>
  );
}
