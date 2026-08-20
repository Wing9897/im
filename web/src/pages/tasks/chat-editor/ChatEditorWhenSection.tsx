import { useTranslation } from "react-i18next";
import { FormGrid } from "../../../components/ui";
import { formHelpClass } from "../../../components/ui/pageTypography";
import type { TaskModeFieldVisibility } from "../../../domain/tasks/taskFormVisibility";
import { ScheduleInput } from "../ScheduleInput";
import type { TaskFormState } from "./useChatEditor";
import { ChatAgentTriggerFields } from "./ChatAgentPolicyFields";
import { ChatEditorSection } from "./ChatEditorSection";

export function ChatEditorWhenSection({
  formState,
  updateField,
  vis,
}: {
  formState: TaskFormState;
  updateField: <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => void;
  vis: TaskModeFieldVisibility;
}) {
  const { t } = useTranslation("common");
  if (!vis.promptFieldsVisible) return null;

  return (
    <ChatEditorSection
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
    </ChatEditorSection>
  );
}
