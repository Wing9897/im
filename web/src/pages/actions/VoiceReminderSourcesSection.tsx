import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getTaskFormAnalysisModeMeta } from "../../components/task/taskFormAnalysisModeMeta";
import { getUserEventsFilterLabel } from "../../domain/timeline/userEvents";
import {
  Badge,
  Button,
  FilterChip,
  PanelSection,
  SelectTile,
  SelectTileGrid,
  formHelpClass,
} from "../../components/ui";
import type { ReminderSourceTask } from "./useVoiceReminderPanelState";

export function VoiceReminderSourcesSection({
  tasksLoading,
  sourceTasks,
  draftTaskIds,
  draftListenAll,
  draftSelectedCount,
  taskSelectionDirty,
  onToggleDraftTask,
  onSelectAll,
  onClearAll,
  onConfirm,
  onResetDraft,
}: {
  tasksLoading: boolean;
  sourceTasks: ReminderSourceTask[];
  draftTaskIds: string[];
  draftListenAll: boolean;
  draftSelectedCount: number;
  taskSelectionDirty: boolean;
  onToggleDraftTask: (taskId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onConfirm: () => void;
  onResetDraft: () => void;
}) {
  const { t } = useTranslation("actions");

  return (
    <PanelSection title={t("voice.sectionSources")} showCount={false}>
      {tasksLoading ? (
        <p className={formHelpClass}>{t("voice.loadingTasks")}</p>
      ) : (
        <div className="flex flex-col gap-md">
          <div className="flex flex-wrap items-center justify-between gap-sm">
            <p className="m-0 text-body text-text-secondary">
              {draftListenAll ? (
                <>
                  {t("voice.previewListenAll")}
                  <span className="font-medium text-text-primary">
                    {t("voice.previewAllSources")}
                  </span>
                  {t("voice.previewTimedEvents")}
                </>
              ) : (
                <>
                  {t("voice.previewSelectedPrefix")}
                  <span className="font-medium text-accent">{draftSelectedCount}</span>
                  {t("voice.previewSelectedSuffix")}
                </>
              )}
              {taskSelectionDirty ? (
                <span className="ml-sm text-caption text-warning">
                  {t("voice.notApplied")}
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-sm">
              <FilterChip
                size="sm"
                active={draftListenAll}
                onClick={onClearAll}
                aria-label={t("voice.listenAllAria")}
              >
                {t("voice.all")}
              </FilterChip>
              <FilterChip
                size="sm"
                active={!draftListenAll && draftSelectedCount === sourceTasks.length}
                onClick={onSelectAll}
                aria-label={t("voice.selectAllTasksAria")}
              >
                {t("voice.selectAll")}
              </FilterChip>
            </div>
          </div>

          <SelectTileGrid columns="repeat(auto-fill, minmax(168px, 1fr))">
            {sourceTasks.map((task) => {
              const selected = draftTaskIds.includes(task.id);
              const sourceLabel =
                task.source === "user"
                  ? getUserEventsFilterLabel()
                  : getTaskFormAnalysisModeMeta(
                      task.source === "recurring"
                        ? "recurring"
                        : task.source === "calendar_task"
                          ? "calendar_task"
                          : "event",
                    ).displayLabel;
              return (
                <SelectTile
                  key={task.id}
                  active={selected}
                  onClick={() => onToggleDraftTask(task.id)}
                  aria-pressed={selected}
                  aria-label={
                    selected
                      ? t("voice.taskSelectedAria", { name: task.name })
                      : t("voice.taskUnselectedAria", { name: task.name })
                  }
                  className="!min-h-0 !p-md"
                >
                  <span className="flex flex-col gap-sm">
                    <span className="flex items-start justify-between gap-sm">
                      <span className="line-clamp-2 min-w-0 flex-1 text-left leading-snug">
                        {task.name}
                      </span>
                      {selected ? (
                        <span
                          className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold text-accent"
                          aria-hidden="true"
                        >
                          <Check size={12} strokeWidth={2.5} />
                          {t("voice.selectedBadge")}
                        </span>
                      ) : null}
                    </span>
                    <Badge tone="info" className="self-start">
                      {sourceLabel}
                    </Badge>
                  </span>
                </SelectTile>
              );
            })}
          </SelectTileGrid>

          <div className="flex flex-wrap items-center gap-sm">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={onConfirm}
              disabled={!taskSelectionDirty}
              aria-label={t("voice.applySourcesAria")}
              data-testid="voice-reminder-confirm-tasks"
            >
              {t("voice.apply")}
            </Button>
            {taskSelectionDirty ? (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={onResetDraft}
                aria-label={t("voice.cancelDraftAria")}
              >
                {t("voice.cancel")}
              </Button>
            ) : null}
          </div>

          <p className={formHelpClass}>{t("voice.sourcesHelp")}</p>
        </div>
      )}
    </PanelSection>
  );
}
