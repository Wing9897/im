import { useTranslation } from "react-i18next";
import { FormGrid } from "../../../components/ui";
import { getTaskFormAnalysisModeMeta } from "../../../components/task/taskFormAnalysisModeMeta";
import { ChatNameModeFields } from "./ChatNameModeFields";
import type { LlmProfileGate } from "./useChatEditorLlmProfiles";
import { applyAgentPolicyFields, ChatAgentModeCards } from "./ChatAgentPolicyFields";
import { isUnmappedTriggerSchedule } from "../../../domain/tasks/triggerSchedule";
import { DEFAULT_AGENT_POLICY } from "../../../domain/tasks/agentTaskPolicy";
import { DEFAULT_AGENT_WAVE_INTERVAL_SECONDS } from "../../../domain/tasks/scheduleDefaults";
import type { TaskModeFieldVisibility } from "../../../domain/tasks/taskFormVisibility";
import type { TaskFormState } from "./useChatEditor";
import { ChatEditorSection } from "./ChatEditorSection";

export function ChatEditorIdentitySection({
  formState,
  updateField,
  vis,
  taskId,
  onLlmProfileGateChange,
}: {
  formState: TaskFormState;
  updateField: <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => void;
  vis: TaskModeFieldVisibility;
  taskId?: string;
  onLlmProfileGateChange?: (gate: LlmProfileGate) => void;
}) {
  const { t } = useTranslation("common");
  const modeMeta = getTaskFormAnalysisModeMeta(formState.analysisMode);

  return (
    <ChatEditorSection
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
    </ChatEditorSection>
  );
}
