import { ArrowUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SourceFilterDialog } from "../../components/SourceFilterDialog";
import { RefreshIndicator } from "../../components/common/RefreshIndicator";
import { TimeFilter, type TimeFilterPreset } from "../../components/TimeFilter";
import { OpsControlBar, SegmentedControl, SelectField } from "../../components/ui";
import { pageOpsControlClass } from "../../components/ui/controlStyles";
import type { IntelligenceSelectedSources } from "../../domain/ui/namedSourceFilters";
import type { ViewMode } from "../../types";
import {
  getIntelligenceSortLabel,
  INTELLIGENCE_SORT_MODES,
  type IntelligenceSortMode,
} from "./intelligenceFeedConfig";
import { IntelligenceSearchFilterControl } from "./IntelligenceSearchFilterControl";

const ctrlClass = `${pageOpsControlClass} shrink-0`;

type IntelligenceTaskOption = {
  id: string;
  name: string;
};

type WorksetOption = {
  id: string;
  name: string;
};

type ExpandTaskOption = {
  id: string;
  worksetId?: string | null;
};

interface IntelligenceToolbarProps {
  isBusy?: boolean;
  search: string;
  setSearch: (value: string) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  timeFilterPreset: TimeFilterPreset;
  onTimeFilterChange: (preset: TimeFilterPreset) => void;
  sortMode: IntelligenceSortMode;
  onSortModeChange: (mode: IntelligenceSortMode) => void;
  selectedSources: IntelligenceSelectedSources;
  setSelectedSources: (ids: IntelligenceSelectedSources) => void;
  intelligenceTasks: IntelligenceTaskOption[];
  worksets?: WorksetOption[];
  expandTasks?: ExpandTaskOption[];
}

/**
 * Single-row ops bar: source filter · sort/time · spacer · search + view.
 * Source filter sits leftmost (same as timeline); search opens a modal.
 * Map hides sort/time (own LIVE window).
 */
export function IntelligenceToolbar({
  isBusy = false,
  search,
  setSearch,
  viewMode,
  setViewMode,
  timeFilterPreset,
  onTimeFilterChange,
  sortMode,
  onSortModeChange,
  selectedSources,
  setSelectedSources,
  intelligenceTasks,
  worksets = [],
  expandTasks,
}: IntelligenceToolbarProps) {
  const { t } = useTranslation("intelligence");
  const { t: tc } = useTranslation("common");
  const isMap = viewMode === "map";

  const viewModeItems = [
    { id: "card", label: tc("ui.viewCard") },
    { id: "list", label: tc("ui.viewList") },
    { id: "map", label: tc("ui.viewMap") },
  ] as const;

  return (
    <OpsControlBar sticky ariaLabel={t("toolbar.aria")} className="im-intelligence-toolbar">
      <div className="shrink-0" data-testid="intelligence-source-filter">
        <SourceFilterDialog
          tasks={intelligenceTasks}
          worksets={worksets}
          expandTasks={expandTasks}
          selection={selectedSources}
          onChange={setSelectedSources}
          ariaLabelPrefix={t("toolbar.taskSelectAria")}
          variant="toolbar"
        />
      </div>

      {!isMap ? (
        <>
          <div className="relative inline-flex shrink-0 items-center">
            <ArrowUpDown
              size={12}
              strokeWidth={2}
              aria-hidden="true"
              className="pointer-events-none absolute left-2 z-[1] text-text-muted"
            />
            <SelectField
              value={sortMode}
              onChange={(e) => onSortModeChange(e.target.value as IntelligenceSortMode)}
              aria-label={t("toolbar.sortAria")}
              data-testid="intelligence-sort-select"
              className={`${ctrlClass} !w-[7.5rem] pl-7 pr-2`}
            >
              {INTELLIGENCE_SORT_MODES.map((key) => (
                <option key={key} value={key}>
                  {getIntelligenceSortLabel(key, t)}
                </option>
              ))}
            </SelectField>
          </div>
          <TimeFilter
            value={timeFilterPreset}
            onChange={onTimeFilterChange}
            className={`${ctrlClass} !w-[5rem] !min-w-[4.5rem] !max-w-[5.5rem] px-2`}
          />
        </>
      ) : null}

      {isBusy ? (
        <span className="inline-flex shrink-0 items-center justify-center">
          <RefreshIndicator label={t("toolbar.refreshing")} />
        </span>
      ) : null}

      <div className="ml-auto flex min-w-0 shrink-0 flex-nowrap items-center gap-1.5">
        <IntelligenceSearchFilterControl search={search} setSearch={setSearch} />
        <SegmentedControl
          layout="inline"
          items={[...viewModeItems]}
          value={viewMode}
          onChange={(id) => setViewMode(id as ViewMode)}
          ariaLabel={t("toolbar.viewAria")}
          className="im-intelligence-view-toggle shrink-0"
        />
      </div>
    </OpsControlBar>
  );
}
