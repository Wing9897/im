import { useTranslation } from "react-i18next";
import { SettingsRow, SelectField, TextField } from "../../../components/ui";
import type { AnalysisMode } from "../../../types";
import {
  getTaskFormAnalysisModeMeta,
  taskFormAnalysisModeOrder,
} from "../../../components/task/taskFormAnalysisModeMeta";

interface ChatNameModeFieldsProps {
  name: string;
  analysisMode: AnalysisMode;
  onNameChange: (value: string) => void;
  onAnalysisModeChange: (value: AnalysisMode) => void;
}

/** Name + analysis mode as two FormGrid cells (no wrapping column). */
export function ChatNameModeFields({
  name,
  analysisMode,
  onNameChange,
  onAnalysisModeChange,
}: ChatNameModeFieldsProps) {
  const { t } = useTranslation("common");

  return (
    <>
      <SettingsRow label={t("tasks.editor.nameLabel")} htmlFor="chat-task-name">
        <TextField
          id="chat-task-name"
          type="text"
          placeholder={t("tasks.editor.namePlaceholder")}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </SettingsRow>
      <SettingsRow label={t("tasks.editor.modeLabel")} htmlFor="chat-analysis-mode">
        <SelectField
          id="chat-analysis-mode"
          value={analysisMode}
          onChange={(e) => onAnalysisModeChange(e.target.value as AnalysisMode)}
        >
          {taskFormAnalysisModeOrder.map((mode) => (
            <option key={mode} value={mode}>
              {getTaskFormAnalysisModeMeta(mode).displayLabel}
            </option>
          ))}
        </SelectField>
      </SettingsRow>
    </>
  );
}
