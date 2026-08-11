import type { TFunction } from "i18next";

import {
  Button,
  FilterChip,
  OpsControlBar,
  TextField,
} from "../../components/ui";
import type { ScheduleTab } from "./scheduleConfig";

interface ScheduleToolbarProps {
  t: TFunction;
  tab: ScheduleTab;
  searchQuery: string;
  onTabChange: (tab: ScheduleTab) => void;
  onSearchQueryChange: (query: string) => void;
  onCreate: () => void;
}

export function ScheduleToolbar({
  t,
  tab,
  searchQuery,
  onTabChange,
  onSearchQueryChange,
  onCreate,
}: ScheduleToolbarProps) {
  return (
    <OpsControlBar
      sticky
      ariaLabel={t("toolbarAria")}
      data-testid="schedule-toolbar"
      className="flex-wrap"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip
          active={tab === "oneOff"}
          onClick={() => onTabChange("oneOff")}
          data-testid="schedule-tab-one-off"
        >
          {t("tabs.oneOff")}
        </FilterChip>
        <FilterChip
          active={tab === "recurring"}
          onClick={() => onTabChange("recurring")}
          data-testid="schedule-tab-recurring"
        >
          {t("tabs.recurring")}
        </FilterChip>
      </div>
      <div className="min-w-[12rem] flex-1">
        <TextField
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchAria")}
          data-testid="schedule-search"
        />
      </div>
      <Button
        variant="primary"
        onClick={onCreate}
        data-testid="schedule-create"
        aria-label={tab === "oneOff" ? t("createOneOffAria") : t("createRecurringAria")}
      >
        {t("create")}
      </Button>
    </OpsControlBar>
  );
}
