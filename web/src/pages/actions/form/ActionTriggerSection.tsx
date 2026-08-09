import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getTaskFormAnalysisModeMeta } from "../../../components/task/taskFormAnalysisModeMeta";
import { MenuSelect, SettingsRow, TextField } from "../../../components/ui";
import type { AnalysisTask } from "../../../types";
import type { ActionFormState, HeaderEntry } from "./useActionFormDialog";

export function ActionTriggerSection({
  form,
  tasks,
  submitting,
  onChange,
}: {
  form: ActionFormState;
  tasks: AnalysisTask[];
  submitting: boolean;
  onChange: (field: keyof ActionFormState, value: string | boolean | number | HeaderEntry[]) => void;
}) {
  const { t } = useTranslation("actions");
  const taskOptions = useMemo(
    () => [
      { value: "", label: t("form.allTasks") },
      ...tasks.map((task) => {
        const modeLabel = getTaskFormAnalysisModeMeta(task.analysisMode).displayLabel;
        return {
          value: task.id,
          label: `${task.name}（${modeLabel}）`,
        };
      }),
    ],
    [t, tasks],
  );
  return (
    <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
      <SettingsRow label={t("form.scoreThresholdLabel")} htmlFor="action-score-threshold">
        <TextField
          id="action-score-threshold"
          type="number"
          step="0.1"
          min="0"
          placeholder={t("form.scoreThresholdPlaceholder")}
          value={form.scoreThreshold}
          onChange={(e) => onChange("scoreThreshold", e.target.value)}
          disabled={submitting}
        />
      </SettingsRow>

      <SettingsRow label={t("form.taskIdLabel")} htmlFor="action-task-id">
        <MenuSelect
          id="action-task-id"
          variant="field"
          value={form.taskId}
          options={taskOptions}
          onChange={(next) => onChange("taskId", next)}
          disabled={submitting}
          aria-label={t("form.taskIdLabel")}
        />
      </SettingsRow>
    </div>
  );
}
