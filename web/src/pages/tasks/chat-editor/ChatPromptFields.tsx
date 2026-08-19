import { useTranslation } from "react-i18next";
import { SettingsRow, TextArea } from "../../../components/ui";
import { formHelpClass } from "../../../components/ui/pageTypography";

interface ChatPromptFieldsProps {
  promptTemplate: string;
  onPromptTemplateChange: (value: string) => void;
  /** Mode-specific prompt label (falls back to editor default). */
  promptLabel?: string;
  promptPlaceholder?: string;
  promptHint?: string;
  /** Mark prompt as required (AI modes that gate save on it). */
  promptRequired?: boolean;
}

/**
 * Full-width prompt. Description lives in Advanced; schedule lives in “when”.
 * Children are FormGrid cells — do not wrap in a column.
 */
export function ChatPromptFields({
  promptTemplate,
  onPromptTemplateChange,
  promptLabel,
  promptPlaceholder,
  promptHint,
  promptRequired = false,
}: ChatPromptFieldsProps) {
  const { t } = useTranslation("common");
  const label = promptLabel?.trim() || t("tasks:editor.promptLabel");
  const placeholder = promptPlaceholder?.trim() || t("tasks:editor.promptPlaceholder");

  return (
    <div className="md:col-span-2">
      <SettingsRow
        label={label}
        htmlFor="chat-prompt-template"
        required={promptRequired}
        requiredTitle={promptRequired ? t("tasks:editor.requiredSuffix") : undefined}
      >
        <TextArea
          id="chat-prompt-template"
          className="min-h-[96px] text-sm"
          placeholder={placeholder}
          value={promptTemplate}
          onChange={(e) => onPromptTemplateChange(e.target.value)}
          data-testid="task-prompt-template"
          required={promptRequired}
          aria-required={promptRequired || undefined}
        />
        {promptHint?.trim() ? (
          <p className={`mt-xs mb-0 ${formHelpClass}`}>{promptHint}</p>
        ) : null}
        {promptRequired && !promptTemplate.trim() ? (
          <p
            className={`mt-xs mb-0 ${formHelpClass} text-error`}
            data-testid="task-prompt-required"
          >
            {t("tasks:editor.saveNeeds.prompt")}
          </p>
        ) : null}
      </SettingsRow>
    </div>
  );
}
