import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { AnalysisTask } from "../../../types/tasks";
import type { TaskCardStats } from "../../../types/dashboard";
import { Button } from "../../../components/ui";
import { TASKS_DETAIL_CHANNELS_EXPANDED_STORAGE_KEY } from "../../../domain/tasks/systemTaskCatalog";
import { usePersistedState } from "../../../hooks/usePersistedState";
import { colorStatusDotStyle } from "../../../styles/statusDot";
import { Badge } from "../../../components/ui/Badge";
import {
  getTaskEmployeeDisplayName,
  getTaskEmployeeIdForMode,
} from "../../../components/task/taskFormAnalysisModeMeta";
import { MODE_BADGE_TONE } from "../../../components/task/analysisModeBadgeTone";
import {
  DetailPresentationShell,
  DetailMetricsRow,
  resolveChannelLabel,
  type DetailPresentation,
} from "../../../components/detail";
import {
  detailDialogFlexColClass,
  detailDialogShellClass,
  taskDetailBadgesClass,
  taskDetailBodyClass,
  taskDetailChannelsClass,
  taskDetailChannelsListClass,
  taskDetailChannelsToggleClass,
  taskDetailDescriptionClass,
  taskDetailFooterClass,
  taskDetailHeaderClass,
  taskDetailMetaLineClass,
  taskDetailStatusPillClass,
  taskDetailTitleClass,
  taskDetailTitleRowClass,
} from "../../../components/detail/classes";
import { formatAnalysisTimeRangeNullable } from "../../../utils/analysis";

const CHANNEL_PREVIEW = 8;

interface TaskDetailViewProps {
  task: AnalysisTask;
  stats?: TaskCardStats;
  channelNameById?: ReadonlyMap<string, string>;
  onClose: () => void;
  onEdit: () => void;
  presentation?: DetailPresentation;
}

export function TaskDetailView({
  task,
  stats,
  channelNameById,
  onClose,
  onEdit,
  presentation = "modal",
}: TaskDetailViewProps) {
  const { t } = useTranslation("common");
  const [channelsExpanded, setChannelsExpanded] = usePersistedState(
    TASKS_DETAIL_CHANNELS_EXPANDED_STORAGE_KEY,
    false,
  );
  const employeeName = getTaskEmployeeDisplayName(
    getTaskEmployeeIdForMode(task.analysisMode),
  );
  const channelLabels = useMemo(() => {
    return task.channelIds.map((ref) => resolveChannelLabel(ref, channelNameById));
  }, [task, channelNameById]);

  const visibleChannels = channelsExpanded
    ? channelLabels
    : channelLabels.slice(0, CHANNEL_PREVIEW);

  const metrics =
    stats
      ? [
          { label: t("tasks.card.unanalyzed"), value: String(stats.unanalyzedCount) },
          { label: t("tasks.card.queued"), value: String(stats.queuedMessageCount) },
          { label: t("tasks.card.analyzed"), value: String(stats.analyzedCount) },
        ]
      : [];

  const timeRange =
    formatAnalysisTimeRangeNullable(task.analysisTimeRange) ?? task.analysisTimeRange;

  const content = (
    <>
      <header className={taskDetailHeaderClass}>
        <div className={taskDetailTitleRowClass}>
          <h2 className={taskDetailTitleClass}>{task.name}</h2>
        </div>
        <div className={taskDetailBadgesClass}>
          <Badge tone={MODE_BADGE_TONE[task.analysisMode]} className="normal-case tracking-normal">
            {employeeName}
          </Badge>
          <span className={taskDetailStatusPillClass}>
            <span
              style={colorStatusDotStyle(task.isActive ? "var(--success)" : "var(--text-muted)")}
              aria-hidden="true"
            />
            {task.isActive ? t("enable") : t("disable")}
          </span>
        </div>
      </header>

      <div className={taskDetailBodyClass}>
        {metrics.length > 0 ? <DetailMetricsRow metrics={metrics} /> : null}

        {stats?.lastErrorMessage ? (
          <div
            className="rounded-md border border-[color-mix(in_srgb,var(--error)_35%,transparent)] bg-[color-mix(in_srgb,var(--error)_8%,transparent)] px-sm py-xs text-caption text-error"
            data-testid="task-detail-batch-error"
          >
            {stats.lastErrorMessage}
          </div>
        ) : null}

        {task.description?.trim() ? (
          <div className={taskDetailDescriptionClass}>{task.description.trim()}</div>
        ) : null}

        <div className={taskDetailMetaLineClass}>
          {t("tasks.detail.timeRange", { range: timeRange || t("emDash") })}
        </div>

        {channelLabels.length > 0 ? (
          <div className={taskDetailChannelsClass}>
            <button
              type="button"
              className={taskDetailChannelsToggleClass}
              data-testid="task-detail-channels-toggle"
              aria-expanded={channelsExpanded}
              onClick={() => setChannelsExpanded((open) => !open)}
            >
              <span>{t("tasks.detail.channelCount", { count: channelLabels.length })}</span>
              {channelsExpanded ? (
                <ChevronUp size={16} aria-hidden="true" />
              ) : (
                <ChevronDown size={16} aria-hidden="true" />
              )}
            </button>
            <ul className={taskDetailChannelsListClass}>
              {visibleChannels.map((name) => (
                <li key={name}>{name}</li>
              ))}
              {!channelsExpanded && channelLabels.length > CHANNEL_PREVIEW ? (
                <li>
                  {t("tasks.detail.channelsMore", {
                    count: channelLabels.length - CHANNEL_PREVIEW,
                  })}
                </li>
              ) : null}
            </ul>
          </div>
        ) : (
          <div className={taskDetailMetaLineClass}>{t("tasks.detail.noChannels")}</div>
        )}
      </div>

      <footer className={taskDetailFooterClass}>
        <Button variant="secondary" onClick={onEdit}>
          {t("edit")}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {t("dialog.close")}
        </Button>
      </footer>
    </>
  );

  return (
    <DetailPresentationShell
      presentation={presentation}
      onClose={onClose}
      className={
        presentation === "inline" ? detailDialogFlexColClass : detailDialogShellClass
      }
      width="min(560px, calc(100vw - 32px))"
      aria-label={t("tasks.detail.ariaLabel", { name: task.name })}
    >
      {content}
    </DetailPresentationShell>
  );
}

export function TaskDetailDialog(props: TaskDetailViewProps) {
  return <TaskDetailView {...props} presentation={props.presentation ?? "modal"} />;
}
