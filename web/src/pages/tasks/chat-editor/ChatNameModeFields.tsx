import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsRow, SelectField, TextField, Button } from "../../../components/ui";
import type { AnalysisMode } from "../../../types";
import {
  getTaskFormAnalysisModeMeta,
  taskFormAnalysisModeOrder,
} from "../../../components/task/taskFormAnalysisModeMeta";
import { WorksetNameDialog } from "../../../components/dialogs/WorksetNameDialog";
import { useTaskCatalog } from "../../../context/TaskCatalogContext";
import { createWorkset } from "../../../api/worksets";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import { useToast } from "../../../context/ToastContext";
import { toError } from "../../../utils/errors";

interface ChatNameModeFieldsProps {
  name: string;
  analysisMode: AnalysisMode;
  worksetId: string | null;
  onNameChange: (value: string) => void;
  onAnalysisModeChange: (value: AnalysisMode) => void;
  onWorksetIdChange: (value: string | null) => void;
}

/** Name + analysis mode + workset as FormGrid cells. */
export function ChatNameModeFields({
  name,
  analysisMode,
  worksetId,
  onNameChange,
  onAnalysisModeChange,
  onWorksetIdChange,
}: ChatNameModeFieldsProps) {
  const { t } = useTranslation("common");
  const { worksets, refreshWorksets } = useTaskCatalog();
  const { showToast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);

  const handleCreateWorkset = async (cleaned: string) => {
    setCreateBusy(true);
    try {
      const created = await createWorkset(cleaned);
      await refreshWorksets();
      onWorksetIdChange(created.id);
      showToast(t("workset.createdToast", { name: created.name }), "success");
      setCreateOpen(false);
    } catch (error) {
      showToast(toError(error).message, "error");
    } finally {
      setCreateBusy(false);
    }
  };

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
      <SettingsRow label={t("workset.ownershipLabel")} htmlFor="chat-workset">
        <div className="flex flex-wrap items-center gap-sm">
          <SelectField
            id="chat-workset"
            value={worksetId ?? ""}
            onChange={(e) => onWorksetIdChange(e.target.value || null)}
            className="min-w-0 flex-1"
          >
            <option value="">{t("workset.unassigned")}</option>
            {worksets.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.id === SYSTEM_WORKSET_ID ? t("workset.generalName") : ws.name}
              </option>
            ))}
          </SelectField>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            {t("workset.create")}
          </Button>
        </div>
      </SettingsRow>
      <WorksetNameDialog
        open={createOpen}
        mode="create"
        busy={createBusy}
        onClose={() => {
          if (!createBusy) setCreateOpen(false);
        }}
        onSubmit={handleCreateWorkset}
      />
    </>
  );
}
