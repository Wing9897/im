/**
 * Unified task outputs: Intelligence page, time planning, notify, and
 * Agent「寫入我的日程」(agent-only).
 */
import { useTranslation } from "react-i18next";
import { formHelpClass } from "../../../components/ui/pageTypography";
import { SelectTile, SelectTileGrid } from "../../../components/ui";
import { NotifyPrefField } from "../../../components/notify/NotifyPrefField";
import { DEFAULT_NOTIFY_PREF, type NotifyPref } from "../../../domain/notify/notifyPref";
import type { AnalysisMode } from "../../../types";

interface ChatOutputFieldsProps {
  analysisMode: AnalysisMode;
  triggerMode: "schedule" | "message_cursor" | "message_threshold";
  outputAnalysisEvents: boolean;
  includeInTimeline: boolean;
  notifyPref: NotifyPref;
  timelineToggleVisible: boolean;
  outputCalendar?: boolean;
  onOutputAnalysisEventsChange: (value: boolean) => void;
  onIncludeInTimelineChange: (value: boolean) => void;
  onNotifyPrefChange: (value: NotifyPref) => void;
  onOutputCalendarChange?: (value: boolean) => void;
}

export function ChatOutputFields({
  analysisMode,
  triggerMode,
  outputAnalysisEvents,
  includeInTimeline,
  notifyPref = DEFAULT_NOTIFY_PREF,
  timelineToggleVisible,
  outputCalendar = false,
  onOutputAnalysisEventsChange,
  onIncludeInTimelineChange,
  onNotifyPrefChange,
  onOutputCalendarChange,
}: ChatOutputFieldsProps) {
  const { t } = useTranslation("common");
  const intelDisabled = analysisMode === "agent" && triggerMode === "message_cursor";
  const showIntelToggle = analysisMode !== "leaderboard";
  const showIntelOffTimelineHint = timelineToggleVisible && showIntelToggle && !outputAnalysisEvents;
  const showCalendarOutput = analysisMode === "agent";

  return (
    <div
      className="flex flex-col gap-sm md:col-span-2"
      data-testid="task-output-fields"
      role="group"
      aria-label={t("tasks:editor.outputAria")}
    >
      <SelectTileGrid columns="repeat(auto-fit, minmax(140px, 1fr))" className="gap-sm">
        {showIntelToggle ? (
          <SelectTile
            compact
            variant="toggle"
            active={outputAnalysisEvents && !intelDisabled}
            disabled={intelDisabled}
            data-testid="task-output-analysis-events"
            aria-label={t("tasks:editor.outputAnalysisEventsAria")}
            title={
              intelDisabled
                ? t("tasks:agent.outputHintCursor")
                : t("tasks:editor.outputAnalysisEventsHint")
            }
            onClick={() => onOutputAnalysisEventsChange(!outputAnalysisEvents)}
          >
            {t("tasks:editor.outputAnalysisEventsLabel")}
          </SelectTile>
        ) : null}

        {timelineToggleVisible ? (
          <SelectTile
            compact
            variant="toggle"
            active={includeInTimeline}
            data-testid="task-include-in-timeline"
            aria-label={t("tasks:editor.includeInTimelineAria")}
            title={t("tasks:editor.includeInTimelineHint")}
            onClick={() => onIncludeInTimelineChange(!includeInTimeline)}
          >
            {t("tasks:editor.includeInTimelineLabel")}
          </SelectTile>
        ) : null}

        {showCalendarOutput ? (
          <SelectTile
            compact
            variant="toggle"
            active={outputCalendar}
            data-testid="task-agent-output-calendar"
            aria-label={t("tasks:agent.output.calendar")}
            onClick={() => onOutputCalendarChange?.(!outputCalendar)}
          >
            {t("tasks:agent.output.calendar")}
          </SelectTile>
        ) : null}

        <NotifyPrefField variant="tile" value={notifyPref} onChange={onNotifyPrefChange} />
      </SelectTileGrid>
      {showCalendarOutput ? (
        <p className={`m-0 ${formHelpClass}`}>
          {triggerMode === "message_cursor"
            ? t("tasks:agent.outputHintCursor")
            : t("tasks:agent.outputHint")}
        </p>
      ) : null}
      {showIntelOffTimelineHint ? (
        <span className={formHelpClass} data-testid="task-output-intel-off-timeline-hint">
          {t("tasks:editor.outputIntelOffTimelineHint")}
        </span>
      ) : null}
    </div>
  );
}
