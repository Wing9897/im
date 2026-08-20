import { useTranslation } from "react-i18next";
import { SettingsRow, TextField } from "../../../components/ui";
import {
  getTaskEmployeeDisplayName,
  getTaskEmployeeIdForMode,
} from "../../../components/task/taskFormAnalysisModeMeta";
import { TaskAvatarStack } from "../../../components/task/TaskAvatarStack";
import { TaskCardEmoji } from "../../../components/task/TaskCardEmoji";
import { patchTask } from "../../../api/tasks";
import { lookupTaskEmoji } from "../../../domain/tasks/taskEmoji";
import { useTaskCatalog } from "../../../context/TaskCatalogContext";
import type { AnalysisMode } from "../../../types";
import type { LlmProfileGate } from "./useChatEditorLlmProfiles";
import { ChatLlmProfileField } from "./ChatLlmProfileField";
import { ChatTaskTypePicker } from "./ChatTaskTypePicker";
import { ChatWorksetField } from "./ChatWorksetField";

interface ChatNameModeFieldsProps {
  name: string;
  analysisMode: AnalysisMode;
  worksetId: string;
  llmProfileId: string;
  onNameChange: (value: string) => void;
  onAnalysisModeChange: (value: AnalysisMode) => void;
  onWorksetIdChange: (value: string) => void;
  onLlmProfileIdChange: (value: string) => void;
  onLlmProfileGateChange?: (gate: LlmProfileGate) => void;
  /** Existing task id enables emoji picker; create form is display-only. */
  taskId?: string;
}

/** Name + task-type picker + workset + LLM profile as FormGrid cells. */
export function ChatNameModeFields({
  name,
  analysisMode,
  worksetId,
  llmProfileId,
  onNameChange,
  onAnalysisModeChange,
  onWorksetIdChange,
  onLlmProfileIdChange,
  onLlmProfileGateChange,
  taskId,
}: ChatNameModeFieldsProps) {
  const { t } = useTranslation("common");
  const { refreshTasks, tasks } = useTaskCatalog();

  const requiredTitle = t("tasks:editor.requiredSuffix");
  const identityEmployeeId = getTaskEmployeeIdForMode(analysisMode);
  const identityEmployeeName = getTaskEmployeeDisplayName(identityEmployeeId);
  const catalogTask = taskId ? tasks.find((task) => task.id === taskId) : undefined;
  const emoji = lookupTaskEmoji(catalogTask?.emoji);
  const canEdit = Boolean((taskId ?? "").trim());
  const setEmoji = async (glyph: string) => {
    const id = (taskId ?? "").trim();
    if (!id) return;
    await patchTask(id, { emoji: glyph.trim() || null });
    await refreshTasks();
  };

  return (
    <>
      <SettingsRow
        className="md:col-span-2"
        label={t("tasks:editor.nameLabel")}
        htmlFor="chat-task-name"
        required
        requiredTitle={requiredTitle}
      >
        <div className="flex min-w-0 items-center gap-sm">
          {canEdit ? (
            <TaskCardEmoji
              emoji={emoji}
              name={name || t("tasks:editor.nameLabel")}
              employeeId={identityEmployeeId}
              employeeName={identityEmployeeName}
              onSelect={setEmoji}
            />
          ) : (
            <TaskAvatarStack
              emoji={emoji}
              employeeId={identityEmployeeId}
              employeeName={identityEmployeeName}
            />
          )}
          <TextField
            id="chat-task-name"
            type="text"
            placeholder={t("tasks:editor.namePlaceholder")}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            required
            aria-required
            className="min-w-0 flex-1"
          />
        </div>
      </SettingsRow>

      <ChatTaskTypePicker
        analysisMode={analysisMode}
        requiredTitle={requiredTitle}
        taskTypeLabel={t("tasks:editor.taskTypeLabel")}
        onAnalysisModeChange={onAnalysisModeChange}
      />

      <ChatWorksetField worksetId={worksetId} onWorksetIdChange={onWorksetIdChange} />

      <ChatLlmProfileField
        llmProfileId={llmProfileId}
        requiredTitle={requiredTitle}
        onLlmProfileIdChange={onLlmProfileIdChange}
        onLlmProfileGateChange={onLlmProfileGateChange}
      />
    </>
  );
}
