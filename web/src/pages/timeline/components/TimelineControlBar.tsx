import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SourceFilterDialog } from "../../../components/SourceFilterDialog";
import type { TimelineScale } from "../../../domain/timeline/dateUtils";
import { OpsControlBar, PillButton, SegmentedControl } from "../../../components/ui";
import type { TimelineSelectedSources } from "../../../domain/timeline/timelineSourceFilter";

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
  worksetId?: string | null;
};

type TimelineControlBarProps = {
  selectedSources: TimelineSelectedSources;
  setSelectedSources: (ids: TimelineSelectedSources) => void;
  timelineTasks: TimelineTaskOption[];
  worksets?: WorksetOption[];
  expandTasks?: ExpandTaskOption[];
  viewMode: "calendar" | "gantt";
  setViewMode: (mode: "calendar" | "gantt") => void;
  timeScale: TimelineScale;
  onJumpTo: (scale: TimelineScale) => void;
  onMoveCursor: (delta: number) => void;
  visibleRangeLabel: string;
  onAddEvent?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  children?: React.ReactNode;
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
  onJumpTo,
  onMoveCursor,
  visibleRangeLabel,
  onAddEvent,
  isFullscreen = false,
  onToggleFullscreen,
  children,
}: TimelineControlBarProps) {
  const { t } = useTranslation("timeline");
  const filterOptions = useMemo(
    () => timelineTasks.map((task) => ({ id: task.id, name: task.name })),
    [timelineTasks],
  );

  const handleScaleClick = (scale: TimelineScale) => {
    onJumpTo(scale);
  };

  const scaleLabel = (scale: TimelineScale) => t(`scale.${scale}`);

  const scales: TimelineScale[] =
    viewMode === "gantt"
      ? ["day", "week", "month", "quarter", "year"]
      : ["day", "week", "month"];

  return (
    <OpsControlBar
      sticky
      ariaLabel={t("toolbar.aria")}
      data-testid="timeline-control-bar"
      className="im-timeline-toolbar !mb-lg overflow-x-auto"
    >
      <div className="shrink-0" data-testid="timeline-source-filter">
        <SourceFilterDialog
          tasks={filterOptions}
          worksets={worksets}
          expandTasks={expandTasks}
          selection={selectedSources}
          onChange={setSelectedSources}
          ariaLabelPrefix={t("toolbar.sourceFilterAria")}
          variant="toolbar"
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

      <div className="flex shrink-0 flex-nowrap items-center gap-1">
        {scales.map((scale) => (
          <PillButton
            key={scale}
            active={timeScale === scale}
            onClick={() => handleScaleClick(scale)}
            title={
              timeScale === scale
                ? t("toolbar.jumpToCurrent", { scale: scaleLabel(scale) })
                : t("toolbar.switchToScale", { scale: scaleLabel(scale) })
            }
          >
            {scaleLabel(scale)}
          </PillButton>
        ))}
      </div>

      <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-1">
        {onAddEvent ? (
          <PillButton
            type="button"
            onClick={onAddEvent}
            title={t("toolbar.addEvent")}
            aria-label={t("toolbar.addEvent")}
          >
            <CalendarPlus size={16} strokeWidth={2.5} aria-hidden="true" />
          </PillButton>
        ) : null}
        {children}
        <PillButton
          onClick={() => handleScaleClick(timeScale)}
          aria-label={t("toolbar.todayAria")}
          title={t("toolbar.todayTitle")}
        >
          <CalendarDays size={16} strokeWidth={2.5} aria-hidden="true" />
        </PillButton>
        <PillButton onClick={() => onMoveCursor(-1)} aria-label={t("toolbar.prevPeriodAria")}>
          <ChevronLeft size={16} strokeWidth={2.5} aria-hidden="true" />
        </PillButton>
        <span className="min-w-[7.5rem] select-none px-1 text-center text-sm font-medium tabular-nums text-text-secondary">
          {visibleRangeLabel}
        </span>
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
    </OpsControlBar>
  );
}
