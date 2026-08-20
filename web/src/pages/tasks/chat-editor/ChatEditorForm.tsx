/**
 * Task form for create/edit — numbered sections on one scroll (not a wizard).
 */
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { getTaskFormAnalysisModeMeta } from "../../../components/task/taskFormAnalysisModeMeta";
import {
  CollapsePanel,
  FormGrid,
  SettingsRow,
  SurfaceCard,
  TextField,
} from "../../../components/ui";
import { formHelpClass } from "../../../components/ui/pageTypography";
import { ChatNameModeFields } from "./ChatNameModeFields";
import type { LlmProfileGate } from "./useChatEditorLlmProfiles";
import {
  applyAgentPolicyFields,
  ChatAgentModeCards,
  ChatAgentSkillsFields,
  ChatAgentTriggerFields,
} from "./ChatAgentPolicyFields";
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
  taskId?: string;
}

function EditorSection({
  step,
  title,
  subtitle,
  ariaLabel,
  testId,
  children,
}: {
  step?: number;
  title: string;
  subtitle?: string;
  ariaLabel: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <SurfaceCard
      material="panel"
      density="compact"
      className="shrink-0"
      aria-label={ariaLabel}
      role="region"
      data-testid={testId}
    >
      <div className="mb-sm flex items-start gap-sm">
        {step != null ? (
          <span
            className="mt-px inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[10px] font-semibold leading-none tabular-nums text-accent"
            aria-hidden="true"
          >
            {step}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="m-0 text-xs font-semibold tracking-wide text-text-secondary">{title}</h2>
          {subtitle ? <p className={`mt-xs mb-0 ${formHelpClass}`}>{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </SurfaceCard>
  );
}

export function ChatEditorForm({
  formState,
  updateField,
  channels,
  onOpenChannelDialog,
  onLlmProfileGateChange,
  taskId,
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
  const advancedRelevant = vis.showMessageGateOverrides || vis.showWaveInterval;
  const [optionalOpen, setOptionalOpen] = useState(advancedRelevant);
  useEffect(() => {
    if (advancedRelevant) setOptionalOpen(true);
  }, [advancedRelevant]);

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
      <EditorSection
        step={1}
        title={t("tasks:editor.stepIdentityTitle")}
        subtitle={t("tasks:editor.stepIdentityHint")}
        ariaLabel={t("tasks:editor.stepIdentityAria")}
        testId="task-editor-step-identity"
      >
        <FormGrid className="gap-lg">
          <ChatNameModeFields
            taskId={taskId}
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
          {vis.isAgent ? (
            <ChatAgentModeCards formState={formState} updateField={updateField} />
          ) : null}
          {!vis.promptFieldsVisible ? (
            <p className="m-0 text-caption text-text-muted md:col-span-2">
              {modeMeta.modeDescription}
            </p>
          ) : null}
        </FormGrid>
      </EditorSection>

      {vis.promptFieldsVisible ? (
        <EditorSection
          step={2}
          title={t("tasks:editor.stepScopeTitle")}
          subtitle={t("tasks:editor.stepScopeHint")}
          ariaLabel={t("tasks:editor.stepScopeAria")}
          testId="task-editor-step-scope"
        >
          <FormGrid className="gap-lg">
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
                      : t("tasks:modes.agent.messageGateHint")}
                  </p>
                ) : null}
              </div>
            ) : vis.isAgent ? (
              <p
                className={`m-0 md:col-span-2 ${formHelpClass}`}
                data-testid="task-agent-channel-hint"
              >
                {t("tasks:modes.agent.pureWebHint")}
              </p>
            ) : null}

            <ChatPromptFields
              promptTemplate={formState.promptTemplate}
              onPromptTemplateChange={(v) => updateField("promptTemplate", v)}
              promptLabel={modeMeta.promptLabel}
              promptPlaceholder={modeMeta.promptPlaceholder}
              promptHint={modeMeta.promptHint}
              promptRequired={vis.promptRequired}
            />
          </FormGrid>
        </EditorSection>
      ) : null}

      {vis.promptFieldsVisible ? (
        <EditorSection
          step={3}
          title={t("tasks:editor.stepWhenTitle")}
          subtitle={t("tasks:editor.stepWhenHint")}
          ariaLabel={t("tasks:editor.stepWhenAria")}
          testId="task-editor-step-when"
        >
          <FormGrid className="gap-lg">
            {vis.showAgentPolicy ? (
              <ChatAgentTriggerFields formState={formState} updateField={updateField} />
            ) : null}
            <div className="md:col-span-2 flex flex-col gap-xs">
              <ScheduleInput
                scheduleType={formState.scheduleType}
                scheduleValue={formState.scheduleValue}
                onScheduleTypeChange={(type) => updateField("scheduleType", type)}
                onScheduleValueChange={(value) => updateField("scheduleValue", value)}
                showAgentWaveInterval={false}
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
          </FormGrid>
        </EditorSection>
      ) : null}

      {vis.outputGroupVisible ? (
        <EditorSection
          step={4}
          title={t("tasks:editor.stepOutputTitle")}
          subtitle={t("tasks:editor.stepOutputHint")}
          ariaLabel={t("tasks:editor.stepOutputAria")}
          testId="task-editor-step-output"
        >
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
            {vis.showAgentPolicy ? (
              <div className="md:col-span-2" data-testid="task-agent-policy">
                <ChatAgentSkillsFields formState={formState} updateField={updateField} />
              </div>
            ) : null}
          </FormGrid>
        </EditorSection>
      ) : null}

      {vis.promptFieldsVisible && (
        <div role="region" aria-label={t("tasks:editor.optionalAria")}>
          <CollapsePanel
            title={t("tasks:editor.optionalTitle")}
            open={optionalOpen}
            onToggle={() => setOptionalOpen((v) => !v)}
          >
            <FormGrid className="gap-lg">
              <SettingsRow
                label={t("tasks:editor.descriptionLabel")}
                htmlFor="chat-task-description"
              >
                <TextField
                  id="chat-task-description"
                  type="text"
                  placeholder={t("tasks:editor.descriptionPlaceholder")}
                  value={formState.description}
                  onChange={(e) => updateField("description", e.target.value)}
                />
              </SettingsRow>

              {vis.showWaveInterval ? (
                <SettingsRow
                  label={t("tasks:schedule.agentWaveInterval")}
                  htmlFor="schedule-project-wave-interval"
                  help={t("tasks:schedule.agentWaveIntervalHelp")}
                >
                  <TextField
                    id="schedule-project-wave-interval"
                    data-testid="schedule-project-wave-interval"
                    type="number"
                    min={0}
                    max={600}
                    step={1}
                    value={agentWaveIntervalSeconds}
                    onChange={(e) => {
                      const trimmed = e.target.value.trim();
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
                    onBlur={(e) => {
                      const trimmed = e.target.value.trim();
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
                    aria-label={t("tasks:schedule.agentWaveIntervalAria")}
                    placeholder="20"
                  />
                </SettingsRow>
              ) : null}

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
