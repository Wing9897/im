import { useTranslation } from "react-i18next";
import { FormGrid } from "../../../components/ui";
import { applyAgentPolicyFields, ChatAgentSkillsFields } from "./ChatAgentPolicyFields";
import { ChatOutputFields } from "./ChatOutputFields";
import { normalizeAgentPolicy } from "../../../domain/tasks/agentTaskPolicy";
import { DEFAULT_NOTIFY_PREF } from "../../../domain/notify/notifyPref";
import type { TaskModeFieldVisibility } from "../../../domain/tasks/taskFormVisibility";
import type { TaskFormState } from "./useChatEditor";
import { ChatEditorSection } from "./ChatEditorSection";

export function ChatEditorOutputSection({
  formState,
  updateField,
  vis,
}: {
  formState: TaskFormState;
  updateField: <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => void;
  vis: TaskModeFieldVisibility;
}) {
  const { t } = useTranslation("common");
  if (!vis.outputGroupVisible) return null;

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
    <ChatEditorSection
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
    </ChatEditorSection>
  );
}
