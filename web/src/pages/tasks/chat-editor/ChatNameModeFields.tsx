import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  SettingsRow,
  SelectField,
  TextField,
  Button,
  SelectTile,
  SelectTileGrid,
} from "../../../components/ui";
import { formHelpClass } from "../../../components/ui/pageTypography";
import type { AnalysisMode } from "../../../types";
import {
  getTaskEmployeeBlurb,
  getTaskEmployeeDisplayName,
  getTaskEmployeeIdForMode,
  taskFormAnalysisModeOrder,
} from "../../../components/task/taskFormAnalysisModeMeta";
import { TaskEmployeeAvatar } from "../../../components/task/TaskEmployeeAvatar";
import { analysisModeForTaskEmployee } from "../../../domain/tasks/taskEmployee";
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

/** Name + task-type picker + workset as FormGrid cells. */
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
      <div className="flex flex-col gap-xs md:col-span-2">
        <span className="text-caption font-semibold tracking-wide text-text-secondary">
          {t("tasks.editor.foundationTitle")}
        </span>
        <p className={`m-0 ${formHelpClass}`}>{t("tasks.editor.foundationHint")}</p>
      </div>

      <SettingsRow label={t("tasks.editor.nameLabel")} htmlFor="chat-task-name">
        <TextField
          id="chat-task-name"
          type="text"
          placeholder={t("tasks.editor.namePlaceholder")}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
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

      <div
        className="flex flex-col gap-sm md:col-span-2"
        role="group"
        aria-label={t("tasks.editor.taskTypeLabel")}
        data-testid="task-employee-picker"
      >
        <span className="text-caption font-medium text-text-primary">
          {t("tasks.editor.taskTypeLabel")}
        </span>
        <SelectTileGrid
          columns="repeat(auto-fit, minmax(148px, 1fr))"
          className="gap-sm"
        >
          {taskFormAnalysisModeOrder.map((mode) => {
            const employeeId = getTaskEmployeeIdForMode(mode);
            const nameLabel = getTaskEmployeeDisplayName(employeeId);
            const blurb = getTaskEmployeeBlurb(employeeId);
            const selected = analysisMode === mode;
            return (
              <SelectTile
                key={mode}
                compact
                active={selected}
                aria-pressed={selected}
                onClick={() =>
                  onAnalysisModeChange(analysisModeForTaskEmployee(employeeId))
                }
                hint={blurb}
                className="min-h-0"
              >
                <span className="flex items-center gap-sm">
                  <TaskEmployeeAvatar
                    employeeId={employeeId}
                    size="sm"
                    label={nameLabel}
                    showRecurringIcon
                  />
                  <span className="leading-snug">{nameLabel}</span>
                </span>
              </SelectTile>
            );
          })}
        </SelectTileGrid>
      </div>

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
