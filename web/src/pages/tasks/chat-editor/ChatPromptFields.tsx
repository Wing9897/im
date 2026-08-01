import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SettingsRow, TextArea, TextField } from "../../../components/ui";

interface ChatPromptFieldsProps {
  description: string;
  promptTemplate: string;
  onDescriptionChange: (value: string) => void;
  onPromptTemplateChange: (value: string) => void;
  /** Optional right-column neighbor for description (e.g. schedule). */
  scheduleSlot?: ReactNode;
}

/**
 * Description (+ optional schedule beside it) and full-width prompt.
 * Children are FormGrid cells — do not wrap in a column.
 */
export function ChatPromptFields({
  description,
  promptTemplate,
  onDescriptionChange,
  onPromptTemplateChange,
  scheduleSlot,
}: ChatPromptFieldsProps) {
  const { t } = useTranslation("common");

  return (
    <>
      <SettingsRow label={t("tasks.editor.descriptionLabel")} htmlFor="chat-task-description">
        <TextField
          id="chat-task-description"
          type="text"
          placeholder={t("tasks.editor.descriptionPlaceholder")}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </SettingsRow>

      {scheduleSlot ?? null}

      <div className="md:col-span-2">
        <SettingsRow label={t("tasks.editor.promptLabel")} htmlFor="chat-prompt-template">
          <TextArea
            id="chat-prompt-template"
            className="min-h-[96px] text-sm"
            placeholder={t("tasks.editor.promptPlaceholder")}
            value={promptTemplate}
            onChange={(e) => onPromptTemplateChange(e.target.value)}
          />
        </SettingsRow>
      </div>
    </>
  );
}
