import { useTranslation } from "react-i18next";
import {
  CollapsePanel,
  FormGrid,
  SettingsRow,
  TextField,
} from "../../../components/ui";
import { DEFAULT_AGENT_WAVE_INTERVAL_SECONDS } from "../../../domain/tasks/scheduleDefaults";
import type { TaskModeFieldVisibility } from "../../../domain/tasks/taskFormVisibility";
import type { TaskFormState } from "./useChatEditor";
import { ChatAnalysisFields } from "./ChatAnalysisFields";
import { ChatScheduleOverrideFields } from "./ChatScheduleOverrideFields";

export function ChatEditorOptionalFields({
  formState,
  updateField,
  vis,
  optionalOpen,
  onToggleOptional,
}: {
  formState: TaskFormState;
  updateField: <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => void;
  vis: TaskModeFieldVisibility;
  optionalOpen: boolean;
  onToggleOptional: () => void;
}) {
  const { t } = useTranslation("common");
  if (!vis.promptFieldsVisible) return null;

  const agentWaveIntervalSeconds = String(
    formState.agentWaveIntervalSeconds ?? DEFAULT_AGENT_WAVE_INTERVAL_SECONDS,
  );

  return (
    <div role="region" aria-label={t("tasks:editor.optionalAria")}>
      <CollapsePanel
        title={t("tasks:editor.optionalTitle")}
        open={optionalOpen}
        onToggle={onToggleOptional}
      >
        <FormGrid className="gap-lg">
          <SettingsRow
            label={t("tasks:editor.descriptionLabel")}
            htmlFor="chat-task-description"
          >
            <TextField
              id="chat-task-description"
              type="text"
              placeholder={t("tasks:editor.descriptionPlaceholder")}
              value={formState.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
          </SettingsRow>

          {vis.showWaveInterval ? (
            <SettingsRow
              label={t("tasks:schedule.agentWaveInterval")}
              htmlFor="schedule-project-wave-interval"
              help={t("tasks:schedule.agentWaveIntervalHelp")}
            >
              <TextField
                id="schedule-project-wave-interval"
                data-testid="schedule-project-wave-interval"
                type="number"
                min={0}
                max={600}
                step={1}
                value={agentWaveIntervalSeconds}
                onChange={(e) => {
                  const trimmed = e.target.value.trim();
                  if (!trimmed) {
                    updateField("agentWaveIntervalSeconds", null);
                    return;
                  }
                  const num = Number(trimmed);
                  updateField(
                    "agentWaveIntervalSeconds",
                    Number.isInteger(num) ? num : null,
                  );
                }}
                onBlur={(e) => {
                  const trimmed = e.target.value.trim();
                  if (!trimmed) {
                    updateField(
                      "agentWaveIntervalSeconds",
                      DEFAULT_AGENT_WAVE_INTERVAL_SECONDS,
                    );
                    return;
                  }
                  const num = Number(trimmed);
                  if (!Number.isInteger(num) || num < 0) {
                    updateField(
                      "agentWaveIntervalSeconds",
                      DEFAULT_AGENT_WAVE_INTERVAL_SECONDS,
                    );
                    return;
                  }
                  updateField("agentWaveIntervalSeconds", Math.min(num, 600));
                }}
                aria-label={t("tasks:schedule.agentWaveIntervalAria")}
                placeholder="20"
              />
            </SettingsRow>
          ) : null}

          {vis.analysisTimeRangeVisible ? (
            <ChatAnalysisFields
              analysisTimeRange={formState.analysisTimeRange}
              onAnalysisTimeRangeChange={(v) => updateField("analysisTimeRange", v)}
            />
          ) : null}

          <ChatScheduleOverrideFields formState={formState} updateField={updateField} />
        </FormGrid>
      </CollapsePanel>
    </div>
  );
}
