import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { AccentBarCard } from "./ui";
import {
  getTaskEmployeeDisplayName,
  getTaskEmployeeIdForMode,
} from "./task/taskFormAnalysisModeMeta";
import { MODE_ACCENT_CLASS } from "./task/analysisModeBadgeTone";
import { TaskCardActions } from "./task/TaskCardActions";
import { TaskCardHeader } from "./task/TaskCardHeader";
import { TaskCardStatsSection } from "./task/TaskCardStatsSection";
import { patchTask } from "../api/tasks";
import { lookupTaskEmoji } from "../domain/tasks/taskEmoji";
import { useTaskCatalog, useWorksetNameById } from "../context/TaskCatalogContext";
import { SelectableSurface } from "./detail/SelectableSurface";
import { colorStatusDotStyle } from "../styles/statusDot";
import { formatAnalysisErrorMessage } from "../domain/analysis/formatAnalysisError";
import { isAgentCalendarTask } from "../domain/tasks/isAgentCalendarTask";
import type { AnalysisTask } from "../types/tasks";
import type { TaskCardStats } from "../types/dashboard";
import { SYSTEM_WORKSET_ID } from "../types/worksets";

export interface TaskCardProps {
  task: AnalysisTask;
  stats: TaskCardStats;
  onToggleActive: (taskId: string) => Promise<void>;
  onEdit: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onSelect?: () => void;
  isSelected?: boolean;
  /** Test override; production reads ``task.emoji``. */
  emoji?: string;
  onEmojiChange?: (emoji: string) => void | Promise<void>;
}

export const TaskCard = React.memo(function TaskCard({
  task,
  stats,
  onToggleActive,
  onEdit,
  onDelete,
  onSelect,
  isSelected = false,
  emoji: emojiProp,
  onEmojiChange,
}: TaskCardProps) {
  const { t } = useTranslation("common");
  const { refreshTasks } = useTaskCatalog();
  const worksetNameById = useWorksetNameById();
  const [toggling, setToggling] = useState(false);
  const isAgentMode = task.analysisMode === "agent";
  const isAgentCalendarMode = isAgentCalendarTask(task);
  const hideAnalysisStats = isAgentMode;
  const employeeId = getTaskEmployeeIdForMode(task.analysisMode);
  const employeeName = getTaskEmployeeDisplayName(employeeId);
  const emoji = emojiProp ?? lookupTaskEmoji(task.emoji);
  const handleEmojiChange =
    onEmojiChange ??
    (async (glyph: string) => {
      await patchTask(task.id, { emoji: glyph.trim() || null });
      await refreshTasks();
    });
  const queuedMessageCount = stats.queuedMessageCount;
  const attentionErrorText = formatAnalysisErrorMessage(stats.lastErrorMessage, t);
  const worksetName =
    worksetNameById.get(task.worksetId?.trim() || SYSTEM_WORKSET_ID) ?? null;

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

  const isAnalyzing = stats.isRunning;
  const runningDotStyle = colorStatusDotStyle(
    isAnalyzing ? "var(--info)" : "var(--text-muted)",
  );

  const toggleLabel = task.isActive
    ? t("tasks:card.disable")
    : t("tasks:card.enable");

  const analyzingLabel = t("tasks:card.analyzingAria", { name: task.name });

  return (
    <SelectableSurface
      variant="none"
      onSelect={onSelect}
      selectAriaLabel={
        onSelect
          ? isAgentCalendarMode
            ? t("tasks:card.openAgentAria", { name: task.name })
            : t("tasks:card.viewDetailAria", { name: task.name })
          : undefined
      }
      className={`relative h-full transition-opacity ${task.isActive ? "opacity-100" : "opacity-[0.72]"}`}
      data-testid={`task-card-${task.id}`}
    >
      <AccentBarCard
        accentClass={MODE_ACCENT_CLASS[task.analysisMode]}
        interactive
        enter="rise"
        className={[
          isSelected
            ? "ring-1 ring-accent ring-offset-1 ring-offset-[var(--surface-base)]"
            : "",
          isAnalyzing ? "im-task-card-analyzing" : "",
        ]
          .filter(Boolean)
          .join(" ") || undefined}
        title={isAnalyzing ? analyzingLabel : undefined}
        data-analyzing={isAnalyzing ? "true" : undefined}
        aria-busy={isAnalyzing || undefined}
      >
        <TaskCardHeader
          task={task}
          emoji={emoji}
          employeeId={employeeId}
          employeeName={employeeName}
          worksetName={worksetName}
          isAgentMode={isAgentMode}
          onEmojiChange={handleEmojiChange}
        />
        <TaskCardStatsSection
          taskId={task.id}
          hideAnalysisStats={hideAnalysisStats}
          isAgentMode={isAgentMode}
          isAgentCalendarMode={isAgentCalendarMode}
          isActive={task.isActive}
          isAnalyzing={isAnalyzing}
          stats={stats}
          queuedMessageCount={queuedMessageCount}
          attentionErrorText={attentionErrorText}
        />
        <TaskCardActions
          taskName={task.name}
          taskId={task.id}
          isActive={task.isActive}
          isAnalyzing={isAnalyzing}
          toggling={toggling}
          runningDotStyle={runningDotStyle}
          toggleLabel={toggleLabel}
          onToggle={handleToggle}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </AccentBarCard>
    </SelectableSurface>
  );
});
