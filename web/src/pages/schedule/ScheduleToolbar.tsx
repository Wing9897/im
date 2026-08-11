import type { TFunction } from "i18next";

import {
  Button,
  OpsControlBar,
  TextField,
} from "../../components/ui";

interface ScheduleToolbarProps {
  t: TFunction;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onCreate: () => void;
}

export function ScheduleToolbar({
  t,
  searchQuery,
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
        aria-label={t("createAria")}
      >
        {t("create")}
      </Button>
    </OpsControlBar>
  );
}
