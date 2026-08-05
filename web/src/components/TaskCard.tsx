import React, { useCallback, useState } from "react";
import { Pencil, PowerOff, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ToggleSwitch } from "./ToggleSwitch";
import { AccentBarCard, Badge } from "./ui";
import { cardTitleClass } from "./ui/pageTypography";
import {
  getTaskEmployeeDisplayName,
  getTaskEmployeeIdForMode,
} from "./task/taskFormAnalysisModeMeta";
import { MODE_ACCENT_CLASS, MODE_BADGE_TONE } from "./task/analysisModeBadgeTone";
import { TaskEmployeeAvatar } from "./task/TaskEmployeeAvatar";
import { useWorksetNameById } from "../context/TaskCatalogContext";
import {
  SelectableSurface,
  stopSelectableActivation,
} from "./detail/SelectableSurface";
import { colorStatusDotStyle } from "../styles/statusDot";
import type { AnalysisTask } from "../types/tasks";
import type { TaskCardStats } from "../types/dashboard";

export type { TaskCardStats };

export interface TaskCardProps {
  task: AnalysisTask;
  stats: TaskCardStats;
  onToggleActive: (taskId: string) => Promise<void>;
  onEdit: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onSelect?: () => void;
  isSelected?: boolean;
}

const actionIconBtnClass =
  "im-icon-btn !h-7 !w-7 !rounded-md text-text-secondary transition-colors";

export const TaskCard = React.memo(function TaskCard({
  task,
  stats,
  onToggleActive,
  onEdit,
  onDelete,
  onSelect,
  isSelected = false,
}: TaskCardProps) {
  const { t } = useTranslation("common");
  const worksetNameById = useWorksetNameById();
  const [toggling, setToggling] = useState(false);
  const isRecurringMode = task.analysisMode === "recurring";
  const isProjectMode = task.analysisMode === "project";
  const isWebIntelMode = task.analysisMode === "web_intel";
  // web_intel has no local message claim — hide batch marker stats.
  const hideAnalysisStats = isProjectMode || isRecurringMode || isWebIntelMode;
  const employeeId = getTaskEmployeeIdForMode(task.analysisMode);
  const employeeName = getTaskEmployeeDisplayName(employeeId);
  const queuedMessageCount = stats.queuedMessageCount;
  const worksetName =
    task.worksetId != null ? worksetNameById.get(task.worksetId) ?? null : null;

  const handleToggle = useCallback(() => {
    setToggling(true);
    void onToggleActive(task.id).finally(() => {
      setToggling(false);
    });
  }, [onToggleActive, task.id]);

  const handleEdit = useCallback(() => {
    onEdit(task.id);
  }, [onEdit, task.id]);

  const handleDelete = useCallback(() => {
    onDelete(task.id);
  }, [onDelete, task.id]);

  const runningDotStyle = colorStatusDotStyle(
    stats.isRunning ? "var(--success)" : "var(--text-muted)",
  );

  const toggleLabel = task.isActive
    ? t("tasks.card.disable")
    : t("tasks.card.enable");

  return (
    <SelectableSurface
      variant="none"
      onSelect={onSelect}
      selectAriaLabel={
        onSelect
          ? isProjectMode
            ? t("tasks.card.openProjectAria", { name: task.name })
            : t("tasks.card.viewDetailAria", { name: task.name })
          : undefined
      }
      className={`relative h-full transition-opacity ${task.isActive ? "opacity-100" : "opacity-[0.72]"}`}
      data-testid={`task-card-${task.id}`}
    >
      <AccentBarCard
        accentClass={MODE_ACCENT_CLASS[task.analysisMode]}
        interactive
        enter="rise"
        className={
          isSelected
            ? "ring-1 ring-accent ring-offset-1 ring-offset-[var(--surface-base)]"
            : undefined
        }
      >
        <div className="flex items-start justify-between gap-sm">
          <div className="flex min-w-0 flex-1 items-center gap-sm">
            {!isRecurringMode ? (
              <TaskEmployeeAvatar employeeId={employeeId} size="xs" label={employeeName} />
            ) : null}
            <span
              className={`min-w-0 flex-1 truncate ${cardTitleClass}`}
              title={task.name}
            >
              {task.name}
            </span>
          </div>
          <Badge tone={MODE_BADGE_TONE[task.analysisMode]}>{employeeName}</Badge>
        </div>

        <div className="text-[11px] text-text-muted">
          {worksetName ? (
            <span className="mb-0.5 block truncate" title={worksetName}>
              {t("workset.cardLabel", { name: worksetName })}
            </span>
          ) : null}
          {isRecurringMode
            ? t("tasks.card.recurring")
            : isProjectMode
              ? t("tasks.card.project")
              : isWebIntelMode
                ? t("tasks.card.web_intel")
                : t("tasks.card.channelsRange", {
                    count: String(task.channelIds.length),
                    range: task.analysisTimeRange,
                  })}
        </div>

        {hideAnalysisStats ? (
          <div
            className="text-[11px] leading-snug text-text-muted"
            data-testid={`task-card-schedule-hint-${task.id}`}
          >
            {isWebIntelMode
              ? t("tasks.card.web_intelProgressHint")
              : isProjectMode
                ? t("tasks.card.projectProgressHint")
                : isRecurringMode
                  ? t("tasks.card.recurringProgressHint")
                  : t("tasks.card.calendarTaskProgressHint")}
            {isProjectMode && queuedMessageCount > 0 ? (
              <span className="mt-0.5 block tabular-nums text-warning">
                {t("tasks.card.queued")}: {queuedMessageCount.toLocaleString()}
              </span>
            ) : null}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-sm text-[11px]">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-text-muted">{t("tasks.card.unanalyzed")}</span>
                <span className="tabular-nums font-medium text-text-primary">
                  {stats.unanalyzedCount.toLocaleString()}
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-text-muted" title={t("tasks.card.queuedTitle")}>
                  {t("tasks.card.queued")}
                </span>
                <span
                  className={`tabular-nums font-medium ${
                    queuedMessageCount > 0 ? "text-warning" : "text-text-primary"
                  }`}
                >
                  {queuedMessageCount.toLocaleString()}
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-text-muted">{t("tasks.card.analyzed")}</span>
                <span className="tabular-nums font-medium text-text-primary">
                  {stats.analyzedCount.toLocaleString()}
                </span>
              </div>
            </div>
            {task.isActive &&
            !stats.isRunning &&
            stats.unanalyzedCount > 0 &&
            stats.unanalyzedCount < stats.triggerThreshold ? (
              <div
                className="text-[11px] leading-snug text-text-muted"
                data-testid={`task-card-waiting-threshold-${task.id}`}
              >
                {t("tasks.card.waitingForThreshold", {
                  count: stats.unanalyzedCount,
                  threshold: stats.triggerThreshold,
                })}
              </div>
            ) : null}
          </>
        )}

        {!hideAnalysisStats &&
        (stats.lastErrorMessage || (stats.retryCount ?? 0) > 0 || stats.analysisPaused) ? (
          <div
            className="flex flex-col gap-0.5 text-[11px] leading-snug"
            data-testid={`task-card-attention-${task.id}`}
          >
            {stats.lastErrorMessage ? (
              <div
                className="text-error line-clamp-2"
                title={stats.lastErrorMessage}
                data-testid={`task-card-error-${task.id}`}
              >
                <Badge tone="danger" className="mr-1 align-middle">
                  {t("board.queue.attention")}
                </Badge>
                {stats.lastErrorMessage}
              </div>
            ) : null}
            {(stats.retryCount ?? 0) > 0 ? (
              <span className="text-warning" data-testid={`task-card-retry-${task.id}`}>
                {t("tasks.card.retryCount", { count: stats.retryCount })}
              </span>
            ) : null}
            {stats.analysisPaused ? (
              <span className="text-warning" data-testid={`task-card-paused-${task.id}`}>
                <Badge tone="warning" className="mr-1 align-middle">
                  {t("board.queue.paused")}
                </Badge>
                {t("tasks.card.analysisPausedHint")}
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          className="mt-auto flex flex-nowrap items-center justify-between gap-sm pt-xs"
          onClick={stopSelectableActivation}
          onKeyDown={stopSelectableActivation}
        >
          <div className="inline-flex min-w-0 flex-nowrap items-center gap-1.5 text-[11px] leading-none text-text-muted">
            {!task.isActive ? (
              <span
                className="inline-flex shrink-0 text-text-muted"
                title={t("tasks.card.disabled")}
                aria-label={t("tasks.card.disabled")}
                data-testid={`task-card-inactive-icon-${task.id}`}
              >
                <PowerOff size={14} strokeWidth={2} aria-hidden="true" />
              </span>
            ) : (
              <span style={runningDotStyle} aria-hidden="true" />
            )}
            <span
              className={[
                "truncate",
                task.isActive && stats.isRunning ? "text-success" : undefined,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {task.isActive
                ? stats.isRunning
                  ? t("tasks.card.running")
                  : t("tasks.card.idle")
                : t("tasks.card.disabled")}
            </span>
          </div>

          <div className="flex shrink-0 flex-nowrap items-center gap-0.5">
            <ToggleSwitch
              checked={task.isActive}
              onChange={handleToggle}
              disabled={toggling}
              showLabel={false}
              label={toggleLabel}
            />
            <button
              type="button"
              className={actionIconBtnClass}
              onClick={handleEdit}
              aria-label={t("tasks.card.editAria", { name: task.name })}
              title={t("tasks.card.edit")}
            >
              <Pencil size={14} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={actionIconBtnClass}
              onClick={handleDelete}
              aria-label={t("tasks.card.deleteAria", { name: task.name })}
              title={t("tasks.card.delete")}
            >
              <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      </AccentBarCard>
    </SelectableSurface>
  );
});
