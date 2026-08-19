import type { TFunction } from "i18next";

import { Button, OpsControlBar, TextField } from "../../components/ui";
import type { Workset } from "../../types/worksets";
import { ScheduleFilterDialog } from "./ScheduleFilterDialog";
import type { ScheduleListFilters } from "./scheduleFilters";

interface ScheduleToolbarProps {
  t: TFunction;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  filters: ScheduleListFilters;
  onFiltersChange: (next: ScheduleListFilters) => void;
  worksets: readonly Workset[];
  onCreate: () => void;
}

export function ScheduleToolbar({
  t,
  searchQuery,
  onSearchQueryChange,
  filters,
  onFiltersChange,
  worksets,
  onCreate,
}: ScheduleToolbarProps) {
  return (
    <OpsControlBar
      sticky
      ariaLabel={t("toolbarAria")}
      data-testid="schedule-toolbar"
      className="flex-wrap"
    >
      <div className="min-w-[10rem] flex-1">
        <TextField
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchAria")}
          data-testid="schedule-search"
        />
      </div>
      <ScheduleFilterDialog
        t={t}
        filters={filters}
        onFiltersChange={onFiltersChange}
        worksets={worksets}
      />
      <Button
        variant="primary"
        onClick={onCreate}
        data-testid="schedule-create"
        aria-label={t("createAria")}
      >
        {t("create")}
      </Button>
    </OpsControlBar>
  );
}
