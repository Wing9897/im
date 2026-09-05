import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CalendarShareConnectionStatusIcon } from "../../../components/calendarShare/CalendarShareConnectionStatusIcon";
import { TimelineSourceFilterDialog, type SubscribeCalendarOption } from "./TimelineSourceFilterDialog";
import { RefreshIndicator } from "../../../components/common/RefreshIndicator";
import {
  OVERVIEW_RANGE_PRESET_IDS,
  type OverviewRangePresetId,
} from "../../../domain/gantt/ganttOverviewWindow";
import type { TimelineScale } from "../../../domain/timeline/dateUtils";
import {
  applyCalendarScalePill,
  calendarScalePills,
  isCalendarScalePillActive,
  type CalendarScalePill,
  type TimelineMonthLayout,
} from "../../../domain/timeline/monthCardSources";
import { MenuSelect, OpsControlBar, PillButton, SegmentedControl } from "../../../components/ui";
import { compactSelectTriggerClass, pageOpsControlClass } from "../../../components/ui/controlStyles";
import type { SourceFilterSelection } from "../../../domain/tasks/sourceFilterSelection";
import type { SubscribeAvailability, SubscribedCalendarSelection } from "../../../domain/calendarShare/subscribedCalendars";

const rangeLabelClass =
  "min-w-[7.5rem] select-none px-1 text-center text-sm font-medium tabular-nums text-text-secondary";

type TimelineTaskOption = {
  id: string;
  name: string;
};

type WorksetOption = {
  id: string;
  name: string;
};

type ExpandTaskOption = {
  id: string;
  name?: string;
  worksetId?: string | null;
  analysisMode?: string | null;
};

type TimelineControlBarProps = {
  selectedSources: SourceFilterSelection;
  setSelectedSources: (ids: SourceFilterSelection) => void;
  timelineTasks: TimelineTaskOption[];
  worksets?: WorksetOption[];
  expandTasks?: ExpandTaskOption[];
  viewMode: "calendar" | "gantt";
  setViewMode: (mode: "calendar" | "gantt") => void;
  timeScale: TimelineScale;
  monthLayout?: TimelineMonthLayout;
  onMonthLayoutChange?: (layout: TimelineMonthLayout) => void;
  onJumpTo: (scale: TimelineScale) => void;
  onMoveCursor: (delta: number) => void;
  visibleRangeLabel: string;
  overviewMode?: boolean;
  onOverviewModeChange?: (next: boolean) => void;
  /** 全局 range-menu value (`12h`…`1y`); empty when the visible span is custom. */
  overviewRangeId?: string;
  onOverviewRangeChange?: (id: OverviewRangePresetId) => void;
  /** `YYYY-MM-DD` for the range-label jump-date picker (calendar and Gantt). */
  jumpDateValue?: string;
  onJumpDate?: (isoDate: string) => void;
  onAddEvent?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /** Show compact spinner in the sticky toolbar (avoids layout jump). */
  showLoadingIndicator?: boolean;
  loadingLabel?: string;
  subscribeCalendars?: SubscribeCalendarOption[];
  selectedSubscribeKeys?: SubscribedCalendarSelection;
  onChangeSubscribeKeys?: (next: SubscribedCalendarSelection) => void;
  subscribeAvailability?: SubscribeAvailability;
  children?: ReactNode;
};

/** Single-row ops bar (task/view · scale · nav). */
export function TimelineControlBar({
  selectedSources,
  setSelectedSources,
  timelineTasks,
  worksets = [],
  expandTasks,
  viewMode,
  setViewMode,
  timeScale,
  monthLayout = "unified",
  onMonthLayoutChange,
  onJumpTo,
  onMoveCursor,
  visibleRangeLabel,
  overviewMode = false,
  onOverviewModeChange,
  overviewRangeId = "",
  onOverviewRangeChange,
  jumpDateValue,
  onJumpDate,
  onAddEvent,
  isFullscreen = false,
  onToggleFullscreen,
  showLoadingIndicator = false,
  loadingLabel,
  subscribeCalendars,
  selectedSubscribeKeys = null,
  onChangeSubscribeKeys,
  subscribeAvailability = "ok",
  children,
}: TimelineControlBarProps) {
  const { t } = useTranslation("timeline");
  const filterOptions = useMemo(
    () => timelineTasks.map((task) => ({ id: task.id, name: task.name })),
    [timelineTasks],
  );
  const overviewRangeOptions = useMemo(
    () =>
      OVERVIEW_RANGE_PRESET_IDS.map((id) => ({
        value: id,
        label: t(`toolbar.rangeOptions.${id}`),
      })),
    [t],
  );

  const handleScaleClick = (pill: CalendarScalePill) => {
    const next = applyCalendarScalePill(pill, viewMode);
    if (next.overviewMode) {
      onOverviewModeChange?.(true);
      return;
    }
    onOverviewModeChange?.(false);
    if (next.monthLayout) onMonthLayoutChange?.(next.monthLayout);
    if (next.timeScale) onJumpTo(next.timeScale);
  };

  const scaleLabel = (pill: CalendarScalePill) => t(`scale.${pill}`);

  const isScaleActive = (pill: CalendarScalePill) =>
    isCalendarScalePillActive(pill, { viewMode, timeScale, monthLayout, overviewMode });

  const scales = calendarScalePills(viewMode);
  const ganttChrome = viewMode === "gantt";
  const showOverviewRange = ganttChrome && overviewMode && Boolean(onOverviewRangeChange);

  return (
    <OpsControlBar
      sticky
      ariaLabel={t("toolbar.aria")}
      data-testid="timeline-control-bar"
      className="im-timeline-toolbar !mb-lg overflow-x-auto"
    >
      <div className="shrink-0" data-testid="timeline-source-filter">
        <TimelineSourceFilterDialog
          tasks={filterOptions}
          worksets={worksets}
          expandTasks={expandTasks}
          selection={selectedSources}
          onChange={setSelectedSources}
          ariaLabelPrefix={t("toolbar.sourceFilterAria")}
          variant="toolbar"
          subscribeCalendars={subscribeCalendars}
          selectedSubscribeKeys={selectedSubscribeKeys}
          onChangeSubscribeKeys={onChangeSubscribeKeys}
          subscribeAvailability={subscribeAvailability}
        />
      </div>

      <SegmentedControl
        layout="inline"
        ariaLabel={t("toolbar.viewAria")}
        value={viewMode}
        onChange={(id) => {
          if (id === "calendar" || id === "gantt") setViewMode(id);
        }}
        items={[
          { id: "calendar", label: t("toolbar.viewCalendar") },
          { id: "gantt", label: t("toolbar.viewGantt") },
        ]}
        className="shrink-0"
      />

      <div className="flex shrink-0 flex-nowrap items-center gap-1" data-testid="timeline-scale-pills">
        {scales.map((scale) => (
          <PillButton
            key={scale}
            active={isScaleActive(scale)}
            onClick={() => handleScaleClick(scale)}
            data-testid={scale === "overview" ? "timeline-overview-mode" : undefined}
            title={
              isScaleActive(scale)
                ? t("toolbar.jumpToCurrent", { scale: scaleLabel(scale) })
                : t("toolbar.switchToScale", { scale: scaleLabel(scale) })
            }
          >
            {scaleLabel(scale)}
          </PillButton>
        ))}
      </div>

      {showOverviewRange ? (
        <MenuSelect
          variant="toolbar"
          menuPortal
          aria-label={t("toolbar.rangeAria")}
          placeholder={t("toolbar.rangePlaceholder")}
          value={overviewRangeId}
          options={overviewRangeOptions}
          onChange={(next) => onOverviewRangeChange?.(next as OverviewRangePresetId)}
          data-testid="gantt-overview-range-select"
          className="shrink-0"
          triggerClassName={`${pageOpsControlClass} ${compactSelectTriggerClass}`}
        />
      ) : null}

      <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
        <div
          className="flex shrink-0 flex-nowrap items-center gap-1"
          data-testid="timeline-toolbar-utilities"
        >
          {/* Always reserve the spinner slot so mount/unmount does not shift toolbar controls. */}
          <span
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center${
              showLoadingIndicator ? "" : " invisible"
            }`}
            data-testid="timeline-toolbar-loading"
            aria-hidden={!showLoadingIndicator}
          >
            {showLoadingIndicator ? (
              <RefreshIndicator label={loadingLabel ?? t("view.refreshing")} />
            ) : null}
          </span>
          <CalendarShareConnectionStatusIcon availability={subscribeAvailability} />
          {onAddEvent ? (
            <PillButton
              type="button"
              onClick={() => onAddEvent()}
              title={t("toolbar.addEvent")}
              aria-label={t("toolbar.addEvent")}
            >
              <CalendarPlus size={16} strokeWidth={2.5} aria-hidden="true" />
            </PillButton>
          ) : null}
          {children}
          <PillButton
            onClick={() => onJumpTo(timeScale)}
            aria-label={t("toolbar.todayAria")}
            title={t("toolbar.todayTitle")}
            data-testid="timeline-jump-now"
          >
            <CalendarDays size={16} strokeWidth={2.5} aria-hidden="true" />
          </PillButton>
        </div>
        <div
          className="flex shrink-0 flex-nowrap items-center gap-1"
          data-testid="timeline-toolbar-navigation"
        >
          <PillButton onClick={() => onMoveCursor(-1)} aria-label={t("toolbar.prevPeriodAria")}>
            <ChevronLeft size={16} strokeWidth={2.5} aria-hidden="true" />
          </PillButton>
          {onJumpDate ? (
            <label
              className={`relative cursor-pointer ${rangeLabelClass}`}
              data-testid="timeline-range-label"
              title={t("toolbar.jumpDateAria")}
              onClick={(event) => {
                const input = event.currentTarget.querySelector("input[type='date']");
                if (input instanceof HTMLInputElement && typeof input.showPicker === "function") {
                  try {
                    input.showPicker();
                  } catch {
                    /* Already open, or the user-gesture check failed. */
                  }
                }
              }}
            >
              <span className="pointer-events-none" aria-hidden="true">
                {visibleRangeLabel}
              </span>
              <input
                type="date"
                aria-label={t("toolbar.jumpDateAria")}
                className="absolute inset-0 h-full w-full min-w-0 cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                data-testid="timeline-jump-date"
                value={jumpDateValue ?? ""}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next) onJumpDate(next);
                }}
              />
            </label>
          ) : (
            <span className={rangeLabelClass} data-testid="timeline-range-label">
              {visibleRangeLabel}
            </span>
          )}
          <PillButton onClick={() => onMoveCursor(1)} aria-label={t("toolbar.nextPeriodAria")}>
            <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" />
          </PillButton>
          {onToggleFullscreen ? (
            <PillButton
              type="button"
              onClick={onToggleFullscreen}
              aria-label={
                isFullscreen ? t("toolbar.exitFullscreen") : t("toolbar.enterFullscreen")
              }
              title={isFullscreen ? t("toolbar.exitFullscreen") : t("toolbar.enterFullscreen")}
              aria-pressed={isFullscreen}
              data-testid="timeline-fullscreen-toggle"
            >
              {isFullscreen ? (
                <Minimize2 size={16} strokeWidth={2.5} aria-hidden="true" />
              ) : (
                <Maximize2 size={16} strokeWidth={2.5} aria-hidden="true" />
              )}
            </PillButton>
          ) : null}
        </div>
      </div>
    </OpsControlBar>
  );
}
