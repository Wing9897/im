import { useMemo, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "../../../components/ModalDialog";
import { Button, FilterChip, FilterTrigger } from "../../../components/ui";
import type { Account, ChannelWithAccount, MessageFilters } from "../../../types";
import { platformDisplayLabel } from "../../../utils/platformRegistry";
import { usePersistedState } from "../../../hooks/usePersistedState";
import {
  clearMessageFilterKey,
  countActiveMessageFilters,
  describeActiveMessageFilters,
  type ActiveMessageFilterChipKey,
} from "../monitorPageModel";
import { MONITOR_FILTER_BAR_OPEN_STORAGE_KEY } from "../../../domain/prefs";
import { FilterPanel } from "./FilterPanel";

interface FilterBarProps {
  filters: MessageFilters;
  onFiltersChange: (filters: MessageFilters) => void;
  accounts: Account[];
  channels: ChannelWithAccount[];
  onReset?: () => void;
  /**
   * When false, only the trigger + dialog render (chips go to `FilterActiveChips`
   * on the toolbar secondary row — matches wall density).
   */
  showChips?: boolean;
}

interface FilterActiveChipsProps {
  filters: MessageFilters;
  onFiltersChange: (filters: MessageFilters) => void;
}

/** Removable active-filter chips for the toolbar secondary row. */
export function FilterActiveChips({
  filters,
  onFiltersChange,
}: FilterActiveChipsProps): ReactNode {
  const { t } = useTranslation("monitor");
  const chips = useMemo(
    () =>
      describeActiveMessageFilters(filters, {
        platformLabel: platformDisplayLabel,
      }),
    [filters],
  );

  if (chips.length === 0) return null;

  const removeChip = (key: ActiveMessageFilterChipKey) => {
    onFiltersChange(clearMessageFilterKey(filters, key));
  };

  return (
    <>
      {chips.map((chip) => (
        <FilterChip
          key={chip.key}
          size="sm"
          active
          className="min-h-7 gap-1 px-2 text-[11px]"
          data-testid={`monitor-filter-chip-${chip.key}`}
          aria-label={t("filter.removeChipAria", { label: chip.label })}
          onClick={() => removeChip(chip.key)}
        >
          <span className="max-w-[140px] truncate">{chip.label}</span>
          <X size={11} strokeWidth={2.2} aria-hidden="true" />
        </FilterChip>
      ))}
    </>
  );
}

/**
 * Monitor filter trigger + optional inline chips + modal dialog.
 */
export function FilterBar({
  filters,
  onFiltersChange,
  accounts,
  channels,
  onReset,
  showChips = true,
}: FilterBarProps) {
  const { t } = useTranslation("monitor");
  const [open, setOpen] = usePersistedState(MONITOR_FILTER_BAR_OPEN_STORAGE_KEY, false);
  const activeCount = countActiveMessageFilters(filters);
  const hasActiveFilters = activeCount > 0;

  const trigger = (
    <span className="relative inline-flex shrink-0">
      <FilterTrigger
        className="relative shrink-0 min-h-7"
        label={<SlidersHorizontal size={16} strokeWidth={2.5} aria-hidden="true" />}
        active={hasActiveFilters || open}
        data-testid="monitor-filter-trigger"
        aria-label={
          hasActiveFilters
            ? t("filter.openAriaActive", { count: activeCount })
            : t("filter.openAria")
        }
        title={t("filter.title")}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      />
      {hasActiveFilters ? (
        <span
          className="pointer-events-none absolute right-1 top-1 size-1.5 rounded-full bg-accent"
          aria-hidden="true"
        />
      ) : null}
    </span>
  );

  return (
    <>
      {showChips ? (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {trigger}
          <FilterActiveChips filters={filters} onFiltersChange={onFiltersChange} />
        </div>
      ) : (
        trigger
      )}

      <ModalDialog
        open={open}
        title={t("filter.dialogTitle")}
        closeAriaLabel={t("filter.dialogCloseAria")}
        onClose={() => setOpen(false)}
        testId="monitor-filter-dialog"
        size="xl"
        bodyPadding="none"
        bodyClassName="overflow-hidden flex flex-col gap-0"
        footerJustify={hasActiveFilters && onReset ? "space-between" : "flex-end"}
        footer={
          <>
            {hasActiveFilters && onReset ? (
              <Button
                type="button"
                variant="secondary"
                onClick={onReset}
                aria-label={t("filter.clearAllAria")}
              >
                {t("filter.clear")}
              </Button>
            ) : null}
            <Button type="button" variant="primary" onClick={() => setOpen(false)}>
              {t("filter.done")}
            </Button>
          </>
        }
      >
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          accounts={accounts}
          channels={channels}
        />
      </ModalDialog>
    </>
  );
}

