import { useTranslation } from "react-i18next";
import { FormGrid } from "../../../components/ui";
import { formHelpClass } from "../../../components/ui/pageTypography";
import { getTaskFormAnalysisModeMeta } from "../../../components/task/taskFormAnalysisModeMeta";
import type { TaskModeFieldVisibility } from "../../../domain/tasks/taskFormVisibility";
import type { ChannelWithSource } from "../../../types";
import type { TaskFormState } from "./useChatEditor";
import { ChatChannelSelector } from "./ChatChannelSelector";
import { ChatPromptFields } from "./ChatPromptFields";
import { ChatEditorSection } from "./ChatEditorSection";

export function ChatEditorScopeSection({
  formState,
  updateField,
  vis,
  channels,
  onOpenChannelDialog,
}: {
  formState: TaskFormState;
  updateField: <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => void;
  vis: TaskModeFieldVisibility;
  channels: ChannelWithSource[];
  onOpenChannelDialog: () => void;
}) {
  const { t } = useTranslation("common");
  const modeMeta = getTaskFormAnalysisModeMeta(formState.analysisMode);
  if (!vis.promptFieldsVisible) return null;

  return (
    <ChatEditorSection
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
    </ChatEditorSection>
  );
}
