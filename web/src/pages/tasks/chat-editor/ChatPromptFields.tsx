import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SettingsRow, TextArea, TextField } from "../../../components/ui";
import { formHelpClass } from "../../../components/ui/pageTypography";

interface ChatPromptFieldsProps {
  description: string;
  promptTemplate: string;
  onDescriptionChange: (value: string) => void;
  onPromptTemplateChange: (value: string) => void;
  /** Optional right-column neighbor for description (e.g. schedule). */
  scheduleSlot?: ReactNode;
  /** Mode-specific prompt label (falls back to editor default). */
  promptLabel?: string;
  promptPlaceholder?: string;
  promptHint?: string;
  /** Optional web-intel search query field rendered above the prompt. */
  webSearchQuerySlot?: ReactNode;
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
  promptLabel,
  promptPlaceholder,
  promptHint,
  webSearchQuerySlot,
}: ChatPromptFieldsProps) {
  const { t } = useTranslation("common");
  const label = promptLabel?.trim() || t("tasks.editor.promptLabel");
  const placeholder = promptPlaceholder?.trim() || t("tasks.editor.promptPlaceholder");

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

      {webSearchQuerySlot ?? null}

      <div className="md:col-span-2">
        <SettingsRow label={label} htmlFor="chat-prompt-template">
          <TextArea
            id="chat-prompt-template"
            className="min-h-[96px] text-sm"
            placeholder={placeholder}
            value={promptTemplate}
            onChange={(e) => onPromptTemplateChange(e.target.value)}
            data-testid="task-prompt-template"
          />
          {promptHint?.trim() ? (
            <p className={`mt-xs mb-0 ${formHelpClass}`}>{promptHint}</p>
          ) : null}
        </SettingsRow>
      </div>
    </>
  );
}
