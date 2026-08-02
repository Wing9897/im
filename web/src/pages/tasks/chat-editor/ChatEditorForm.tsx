/**
 * Task form for create/edit — L1 foundation + L2 employee + L3 skills.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getTaskFormAnalysisModeMeta } from "../../../components/task/taskFormAnalysisModeMeta";
import { CollapsePanel, FormGrid, SurfaceCard } from "../../../components/ui";
import { formHelpClass, formLabelClass } from "../../../components/ui/pageTypography";
import { ChatNameModeFields } from "./ChatNameModeFields";
import { ChatCalendarFields } from "./ChatCalendarFields";
import { ScheduleInput } from "../ScheduleInput";
import { ChatPromptFields } from "./ChatPromptFields";
import { ChatAnalysisFields } from "./ChatAnalysisFields";
import { ChatChannelSelector } from "./ChatChannelSelector";
import { ChatScheduleOverrideFields } from "./ChatScheduleOverrideFields";
import { DEFAULT_PROJECT_WAVE_INTERVAL_SECONDS } from "../../../domain/tasks/scheduleDefaults";
import type { ChannelWithAccount } from "../../../types";
import type { TaskFormState } from "./useChatEditor";

interface ChatEditorFormProps {
  formState: TaskFormState;
  updateField: <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => void;
  channels: ChannelWithAccount[];
  onOpenChannelDialog: () => void;
}

export function ChatEditorForm({
  formState,
  updateField,
  channels,
  onOpenChannelDialog,
}: ChatEditorFormProps) {
  const { t } = useTranslation("common");
  const modeMeta = getTaskFormAnalysisModeMeta(formState.analysisMode);
  const isRecurringMode = Boolean(modeMeta.isRecurringMode);
  const hidePromptAndChannel = Boolean(modeMeta.hidesPromptAndChannel);
  const isProjectMode = formState.analysisMode === "project";
  const [optionalOpen, setOptionalOpen] = useState(true);

  const projectWaveIntervalSeconds = String(
    formState.projectWaveIntervalSeconds ?? DEFAULT_PROJECT_WAVE_INTERVAL_SECONDS,
  );

  return (
    <div className="flex flex-col gap-sm" data-testid="task-editor-form">
      <SurfaceCard
        material="glass"
        density="compact"
        className="shrink-0"
        aria-label={t("tasks.editor.requiredAria")}
        role="region"
      >
        <h2 className="mb-sm mt-0 text-xs font-semibold tracking-wide text-text-secondary">
          {t("tasks.editor.settingsTitle")}
        </h2>

        <FormGrid className="gap-lg">
          <ChatNameModeFields
            name={formState.name}
            analysisMode={formState.analysisMode}
            worksetId={formState.worksetId}
            onNameChange={(v) => updateField("name", v)}
            onAnalysisModeChange={(v) => {
              updateField("analysisMode", v);
              if (v === "project" && formState.scheduleType === "seconds_10") {
                updateField("scheduleType", "hourly");
              }
              if (v === "project" && formState.projectWaveIntervalSeconds == null) {
                updateField("projectWaveIntervalSeconds", DEFAULT_PROJECT_WAVE_INTERVAL_SECONDS);
              }
            }}
            onWorksetIdChange={(v) => updateField("worksetId", v)}
          />
        </FormGrid>
      </SurfaceCard>

      <SurfaceCard
        material="glass"
        density="compact"
        className="shrink-0"
        aria-label={t("tasks.editor.skillsAria")}
        role="region"
        data-testid="task-skills-section"
      >
        <h2 className="mb-xs mt-0 text-xs font-semibold tracking-wide text-text-secondary">
          {t("tasks.editor.skillsTitle")}
        </h2>
        <p className={`mb-sm mt-0 ${formHelpClass}`}>{t("tasks.editor.skillsHint")}</p>

        <FormGrid className="gap-lg">
          {isRecurringMode ? (
            <div className="md:col-span-2">
              <ChatCalendarFields formState={formState} updateField={updateField} />
            </div>
          ) : hidePromptAndChannel ? (
            <p className="m-0 text-caption text-text-muted md:col-span-2">
              {modeMeta.modeDescription}
            </p>
          ) : (
            <>
              <ChatPromptFields
                description={formState.description}
                promptTemplate={formState.promptTemplate}
                onDescriptionChange={(v) => updateField("description", v)}
                onPromptTemplateChange={(v) => updateField("promptTemplate", v)}
                scheduleSlot={
                  <ScheduleInput
                    scheduleType={formState.scheduleType}
                    scheduleValue={formState.scheduleValue}
                    scheduleRrule={formState.scheduleRrule}
                    onScheduleTypeChange={(type) => updateField("scheduleType", type)}
                    onScheduleValueChange={(value) => updateField("scheduleValue", value)}
                    showProjectWaveInterval={isProjectMode}
                    projectWaveIntervalSeconds={projectWaveIntervalSeconds}
                    onProjectWaveIntervalSecondsChange={(value) => {
                      const trimmed = value.trim();
                      if (!trimmed) {
                        updateField("projectWaveIntervalSeconds", null);
                        return;
                      }
                      const num = Number(trimmed);
                      updateField(
                        "projectWaveIntervalSeconds",
                        Number.isInteger(num) ? num : null,
                      );
                    }}
                    onProjectWaveIntervalSecondsCommit={(value) => {
                      const trimmed = value.trim();
                      if (!trimmed) {
                        updateField(
                          "projectWaveIntervalSeconds",
                          DEFAULT_PROJECT_WAVE_INTERVAL_SECONDS,
                        );
                        return;
                      }
                      const num = Number(trimmed);
                      if (!Number.isInteger(num) || num < 0) {
                        updateField(
                          "projectWaveIntervalSeconds",
                          DEFAULT_PROJECT_WAVE_INTERVAL_SECONDS,
                        );
                        return;
                      }
                      updateField("projectWaveIntervalSeconds", Math.min(num, 600));
                    }}
                  />
                }
              />

              <div className="md:col-span-2">
                <ChatChannelSelector
                  channelIds={formState.channelIds}
                  channels={channels}
                  onOpenChannelDialog={onOpenChannelDialog}
                />
              </div>
            </>
          )}
        </FormGrid>
      </SurfaceCard>

      {!hidePromptAndChannel && (
        <div role="region" aria-label={t("tasks.editor.optionalAria")}>
          <CollapsePanel
            title={t("tasks.editor.optionalTitle")}
            open={optionalOpen}
            onToggle={() => setOptionalOpen((v) => !v)}
          >
            <FormGrid className="gap-lg">
              <ChatAnalysisFields
                analysisTimeRange={formState.analysisTimeRange}
                onAnalysisTimeRangeChange={(v) => updateField("analysisTimeRange", v)}
              />

              {formState.analysisMode === "event" || formState.analysisMode === "project" ? (
                <label className="flex items-start gap-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={formState.includeInTimeline}
                    onChange={(e) => updateField("includeInTimeline", e.target.checked)}
                    data-testid="task-include-in-timeline"
                    aria-label={t("tasks.editor.includeInTimelineAria")}
                  />
                  <span>
                    <span className={formLabelClass}>{t("tasks.editor.includeInTimelineLabel")}</span>
                    <span className={`block ${formHelpClass}`}>
                      {t("tasks.editor.includeInTimelineHint")}
                    </span>
                  </span>
                </label>
              ) : (
                <div className="hidden md:block" aria-hidden="true" />
              )}

              <ChatScheduleOverrideFields formState={formState} updateField={updateField} />
            </FormGrid>
          </CollapsePanel>
        </div>
      )}
    </div>
  );
}
