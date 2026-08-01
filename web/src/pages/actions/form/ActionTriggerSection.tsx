import { useTranslation } from "react-i18next";
import { getTaskFormAnalysisModeMeta } from "../../../components/task/taskFormAnalysisModeMeta";
import { SelectField, SettingsRow, TextField } from "../../../components/ui";
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
        <SelectField
          id="action-task-id"
          value={form.taskId}
          onChange={(e) => onChange("taskId", e.target.value)}
          disabled={submitting}
        >
          <option value="">{t("form.allTasks")}</option>
          {tasks.map((task) => {
            const modeLabel = getTaskFormAnalysisModeMeta(task.analysisMode).displayLabel;
            return (
              <option key={task.id} value={task.id}>
                {task.name}（{modeLabel}）
              </option>
            );
          })}
        </SelectField>
      </SettingsRow>
    </div>
  );
}
