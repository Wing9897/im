/**
 * Task form for create/edit — L1 foundation + L2 employee + L3 skills.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getTaskFormAnalysisModeMeta } from "../../../components/task/taskFormAnalysisModeMeta";
import { CollapsePanel, FormGrid, SurfaceCard } from "../../../components/ui";
import { formHelpClass } from "../../../components/ui/pageTypography";
import { ChatNameModeFields } from "./ChatNameModeFields";
import type { LlmProfileGate } from "./useChatEditorLlmProfiles";
import { applyAgentPolicyFields, ChatAgentPolicyFields } from "./ChatAgentPolicyFields";
import { ChatOutputFields } from "./ChatOutputFields";
import { isUnmappedTriggerSchedule } from "../../../domain/tasks/triggerSchedule";
import { getTaskModeFieldVisibility } from "../../../domain/tasks/taskFormUtils";
import { DEFAULT_AGENT_POLICY, normalizeAgentPolicy } from "../../../domain/tasks/agentTaskPolicy";
import { DEFAULT_NOTIFY_PREF } from "../../../domain/notify/notifyPref";
import { ScheduleInput } from "../ScheduleInput";
import { ChatPromptFields } from "./ChatPromptFields";
import { ChatAnalysisFields } from "./ChatAnalysisFields";
import { ChatChannelSelector } from "./ChatChannelSelector";
import { ChatScheduleOverrideFields } from "./ChatScheduleOverrideFields";
import { DEFAULT_AGENT_WAVE_INTERVAL_SECONDS } from "../../../domain/tasks/scheduleDefaults";
import type { ChannelWithSource } from "../../../types";
import type { TaskFormState } from "./useChatEditor";

interface ChatEditorFormProps {
  formState: TaskFormState;
  updateField: <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => void;
  channels: ChannelWithSource[];
  onOpenChannelDialog: () => void;
  onLlmProfileGateChange?: (gate: LlmProfileGate) => void;
}

export function ChatEditorForm({
  formState,
  updateField,
  channels,
  onOpenChannelDialog,
  onLlmProfileGateChange,
}: ChatEditorFormProps) {
  const { t } = useTranslation("common");
  const modeMeta = getTaskFormAnalysisModeMeta(formState.analysisMode);
  const agentPolicy = {
    triggerMode: formState.triggerMode,
    capCalendarRead: formState.capCalendarRead,
    capCalendarWrites: formState.capCalendarWrites,
    capWebSearch: formState.capWebSearch,
    capForceWebSearch: formState.capForceWebSearch,
    capReadAnalysisEvents: formState.capReadAnalysisEvents,
    capReadItems: formState.capReadItems,
    outputCalendar: formState.outputCalendar,
    outputAnalysisEvents: formState.outputAnalysisEvents,
  };
  const vis = getTaskModeFieldVisibility(
    formState.analysisMode,
    agentPolicy,
    formState.channelIds,
  );
  const gateOpen = vis.showMessageGateOverrides;
  const [optionalOpen, setOptionalOpen] = useState(gateOpen);
  useEffect(() => {
    if (gateOpen) setOptionalOpen(true);
  }, [gateOpen]);

  const agentWaveIntervalSeconds = String(
    formState.agentWaveIntervalSeconds ?? DEFAULT_AGENT_WAVE_INTERVAL_SECONDS,
  );

  const handleOutputAnalysisEventsChange = (checked: boolean) => {
    if (formState.analysisMode !== "agent") {
      updateField("outputAnalysisEvents", checked);
      return;
    }
    applyAgentPolicyFields(
      updateField,
      normalizeAgentPolicy(
        { ...agentPolicy, outputAnalysisEvents: checked },
        { hasChannels: formState.channelIds.length > 0 },
      ),
    );
  };

  const handleOutputCalendarChange = (checked: boolean) => {
    applyAgentPolicyFields(
      updateField,
      normalizeAgentPolicy(
        { ...agentPolicy, outputCalendar: checked },
        { hasChannels: formState.channelIds.length > 0 },
      ),
    );
  };

  return (
    <div className="flex flex-col gap-sm" data-testid="task-editor-form">
      <SurfaceCard
        material="panel"
        density="compact"
        className="shrink-0"
        aria-label={t("tasks:editor.requiredAria")}
        role="region"
      >
        <h2 className="mb-sm mt-0 text-xs font-semibold tracking-wide text-text-secondary">
          {t("tasks:editor.settingsTitle")}
        </h2>

        <FormGrid className="gap-lg">
          <ChatNameModeFields
            name={formState.name}
            analysisMode={formState.analysisMode}
            worksetId={formState.worksetId}
            llmProfileId={formState.llmProfileId}
            onNameChange={(v) => updateField("name", v)}
            onAnalysisModeChange={(v) => {
              updateField("analysisMode", v);
              if (
                v === "agent" &&
                formState.scheduleType === "seconds_10" &&
                !isUnmappedTriggerSchedule(
                  formState.scheduleType,
                  formState.scheduleValue,
                  formState.scheduleRrule,
                )
              ) {
                updateField("scheduleType", "hourly");
              }
              if (v === "agent") {
                applyAgentPolicyFields(updateField, DEFAULT_AGENT_POLICY);
                if (formState.agentWaveIntervalSeconds == null) {
                  updateField("agentWaveIntervalSeconds", DEFAULT_AGENT_WAVE_INTERVAL_SECONDS);
                }
              } else {
                updateField("outputAnalysisEvents", v === "intel_event");
              }
            }}
            onWorksetIdChange={(v) => updateField("worksetId", v)}
            onLlmProfileIdChange={(v) => updateField("llmProfileId", v)}
            onLlmProfileGateChange={onLlmProfileGateChange}
          />
        </FormGrid>
      </SurfaceCard>

      {vis.outputGroupVisible ? (
        <SurfaceCard
          material="panel"
          density="compact"
          className="shrink-0"
          aria-label={t("tasks:editor.outputAria")}
          role="region"
        >
          <h2 className="mb-sm mt-0 text-xs font-semibold tracking-wide text-text-secondary">
            {t("tasks:editor.outputTitle")}
          </h2>
          <FormGrid className="gap-lg">
            <ChatOutputFields
              analysisMode={formState.analysisMode}
              triggerMode={formState.triggerMode}
              outputAnalysisEvents={formState.outputAnalysisEvents}
              includeInTimeline={formState.includeInTimeline}
              notifyPref={formState.notifyPref ?? DEFAULT_NOTIFY_PREF}
              timelineToggleVisible={vis.timelineToggleVisible}
              outputCalendar={formState.outputCalendar}
              onOutputAnalysisEventsChange={handleOutputAnalysisEventsChange}
              onIncludeInTimelineChange={(v) => updateField("includeInTimeline", v)}
              onNotifyPrefChange={(v) => updateField("notifyPref", v)}
              onOutputCalendarChange={handleOutputCalendarChange}
            />
          </FormGrid>
        </SurfaceCard>
      ) : null}

      <SurfaceCard
        material="panel"
        density="compact"
        className="shrink-0"
        aria-label={t("tasks:editor.skillsAria")}
        role="region"
        data-testid="task-skills-section"
      >
        <h2 className="mb-sm mt-0 text-xs font-semibold tracking-wide text-text-secondary">
          {t("tasks:editor.skillsTitle")}
        </h2>

        <FormGrid className="gap-lg">
          {!vis.promptFieldsVisible ? (
            <p className="m-0 text-caption text-text-muted md:col-span-2">
              {modeMeta.modeDescription}
            </p>
          ) : (
            <>
              {vis.showAgentPolicy ? (
                <ChatAgentPolicyFields formState={formState} updateField={updateField} />
              ) : null}

              <ChatPromptFields
                description={formState.description}
                promptTemplate={formState.promptTemplate}
                onDescriptionChange={(v) => updateField("description", v)}
                onPromptTemplateChange={(v) => updateField("promptTemplate", v)}
                promptLabel={modeMeta.promptLabel}
                promptPlaceholder={modeMeta.promptPlaceholder}
                promptHint={modeMeta.promptHint}
                scheduleSlot={
                  <div className="flex flex-col gap-xs">
                    <ScheduleInput
                      scheduleType={formState.scheduleType}
                      scheduleValue={formState.scheduleValue}
                      scheduleRrule={formState.scheduleRrule}
                      onScheduleTypeChange={(type) => updateField("scheduleType", type)}
                      onScheduleValueChange={(value) => updateField("scheduleValue", value)}
                      showAgentWaveInterval={vis.showWaveInterval}
                      agentWaveIntervalSeconds={agentWaveIntervalSeconds}
                      onProjectWaveIntervalSecondsChange={(value) => {
                        const trimmed = value.trim();
                        if (!trimmed) {
                          updateField("agentWaveIntervalSeconds", null);
                          return;
                        }
                        const num = Number(trimmed);
                        updateField(
                          "agentWaveIntervalSeconds",
                          Number.isInteger(num) ? num : null,
                        );
                      }}
                      onProjectWaveIntervalSecondsCommit={(value) => {
                        const trimmed = value.trim();
                        if (!trimmed) {
                          updateField(
                            "agentWaveIntervalSeconds",
                            DEFAULT_AGENT_WAVE_INTERVAL_SECONDS,
                          );
                          return;
                        }
                        const num = Number(trimmed);
                        if (!Number.isInteger(num) || num < 0) {
                          updateField(
                            "agentWaveIntervalSeconds",
                            DEFAULT_AGENT_WAVE_INTERVAL_SECONDS,
                          );
                          return;
                        }
                        updateField("agentWaveIntervalSeconds", Math.min(num, 600));
                      }}
                    />
                    {vis.isAgent ? (
                      <p
                        className={`m-0 ${formHelpClass}`}
                        data-testid="task-agent-schedule-hint"
                      >
                        {t("tasks:modes.agent.scheduleDefaultHint")}
                      </p>
                    ) : null}
                  </div>
                }
                promptRequired={vis.promptRequired}
              />

              {vis.channelFieldsVisible ? (
                <div className="md:col-span-2 flex flex-col gap-xs">
                  <ChatChannelSelector
                    channelIds={formState.channelIds}
                    channels={channels}
                    onOpenChannelDialog={onOpenChannelDialog}
                    optional={vis.channelsOptional}
                  />
                  {vis.isAgent ? (
                    <p
                      className={`m-0 ${formHelpClass}`}
                      data-testid="task-agent-channel-hint"
                    >
                      {formState.triggerMode === "message_cursor"
                        ? t("tasks:modes.agent.cursorChannelHint")
                        : formState.channelIds.length > 0
                          ? t("tasks:modes.agent.messageGateHint")
                          : t("tasks:modes.agent.timedModeHint")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </FormGrid>
      </SurfaceCard>

      {vis.promptFieldsVisible && (
        <div role="region" aria-label={t("tasks:editor.optionalAria")}>
          <CollapsePanel
            title={t("tasks:editor.optionalTitle")}
            open={optionalOpen}
            onToggle={() => setOptionalOpen((v) => !v)}
          >
            <FormGrid className="gap-lg">
              {vis.analysisTimeRangeVisible ? (
                <ChatAnalysisFields
                  analysisTimeRange={formState.analysisTimeRange}
                  onAnalysisTimeRangeChange={(v) => updateField("analysisTimeRange", v)}
                />
              ) : null}

              <ChatScheduleOverrideFields formState={formState} updateField={updateField} />
            </FormGrid>
          </CollapsePanel>
        </div>
      )}
    </div>
  );
}
