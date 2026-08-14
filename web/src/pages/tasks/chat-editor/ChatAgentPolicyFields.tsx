/**
 * Agent preset + trigger / capability / output fields for ChatEditorForm.
 */
import { useTranslation } from "react-i18next";
import { formHelpClass, formLabelClass } from "../../../components/ui/pageTypography";
import { SelectField } from "../../../components/ui/TextField";
import {
  AGENT_PRESET_PROJECT_RECONCILE,
  AGENT_PRESET_WEB_SCOUT,
  normalizeAgentPolicy,
  type AgentPresetId,
  type AgentTaskPolicy,
  type AgentTriggerMode,
} from "../../../domain/tasks/agentTaskPolicy";
import type { TaskFormState } from "./useChatEditor";

interface ChatAgentPolicyFieldsProps {
  formState: TaskFormState;
  updateField: <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => void;
}

function policyFromForm(formState: TaskFormState): AgentTaskPolicy {
  return {
    triggerMode: formState.triggerMode,
    capCalendarRead: formState.capCalendarRead,
    capCalendarWrites: formState.capCalendarWrites,
    capWebSearch: formState.capWebSearch,
    capForceWebSearch: formState.capForceWebSearch,
    capReadAnalysisEvents: formState.capReadAnalysisEvents,
    capReadItems: formState.capReadItems,
    outputCalendar: formState.outputCalendar,
    outputAnalysisEvents: formState.outputAnalysisEvents,
  };
}

function applyPolicy(
  updateField: ChatAgentPolicyFieldsProps["updateField"],
  policy: AgentTaskPolicy,
) {
  updateField("triggerMode", policy.triggerMode);
  updateField("capCalendarRead", policy.capCalendarRead);
  updateField("capCalendarWrites", policy.capCalendarWrites);
  updateField("capWebSearch", policy.capWebSearch);
  updateField("capForceWebSearch", policy.capForceWebSearch);
  updateField("capReadAnalysisEvents", policy.capReadAnalysisEvents);
  updateField("capReadItems", policy.capReadItems);
  updateField("outputCalendar", policy.outputCalendar);
  updateField("outputAnalysisEvents", policy.outputAnalysisEvents);
}

const TRIGGER_OPTIONS: { value: AgentTriggerMode; key: string }[] = [
  { value: "schedule", key: "tasks:agent.trigger.schedule" },
  { value: "message_cursor", key: "tasks:agent.trigger.message_cursor" },
  { value: "message_threshold", key: "tasks:agent.trigger.message_threshold" },
];

export function ChatAgentPolicyFields({ formState, updateField }: ChatAgentPolicyFieldsProps) {
  const { t } = useTranslation("common");
  const hasChannels = formState.channelIds.length > 0;

  const applyPreset = (preset: AgentPresetId) => {
    const next =
      preset === AGENT_PRESET_WEB_SCOUT
        ? normalizeAgentPolicy(
            {
              triggerMode: hasChannels ? "message_threshold" : "schedule",
              capCalendarRead: true,
              capCalendarWrites: false,
              capWebSearch: true,
              capForceWebSearch: true,
              capReadAnalysisEvents: true,
              capReadItems: true,
              outputCalendar: false,
              outputAnalysisEvents: true,
            },
            { hasChannels },
          )
        : normalizeAgentPolicy(
            {
              triggerMode: "message_cursor",
              capCalendarRead: true,
              capCalendarWrites: true,
              capWebSearch: false,
              capForceWebSearch: false,
              capReadAnalysisEvents: true,
              capReadItems: true,
              outputCalendar: true,
              outputAnalysisEvents: false,
            },
            { hasChannels: true },
          );
    applyPolicy(updateField, next);
    if (preset === AGENT_PRESET_PROJECT_RECONCILE && formState.agentWaveIntervalSeconds == null) {
      updateField("agentWaveIntervalSeconds", 20);
    }
  };

  const patchPolicy = (patch: Partial<AgentTaskPolicy>) => {
    const next = normalizeAgentPolicy(
      { ...policyFromForm(formState), ...patch },
      { hasChannels },
    );
    applyPolicy(updateField, next);
  };

  return (
    <div className="md:col-span-2 flex flex-col gap-md" data-testid="task-agent-policy">
      <div className="flex flex-col gap-xs">
        <span className={formLabelClass}>{t("tasks:agent.presetsLabel")}</span>
        <div className="flex flex-wrap gap-sm">
          <button
            type="button"
            className="rounded-md border border-border px-sm py-xs text-caption"
            data-testid="task-agent-preset-project"
            onClick={() => applyPreset(AGENT_PRESET_PROJECT_RECONCILE)}
          >
            {t("tasks:agent.presets.project_reconcile")}
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-sm py-xs text-caption"
            data-testid="task-agent-preset-web"
            onClick={() => applyPreset(AGENT_PRESET_WEB_SCOUT)}
          >
            {t("tasks:agent.presets.web_scout")}
          </button>
        </div>
        <p className={`m-0 ${formHelpClass}`}>{t("tasks:agent.presetsHint")}</p>
      </div>

      <div className="flex flex-col gap-xs">
        <label className={formLabelClass} htmlFor="task-agent-trigger">
          {t("tasks:agent.triggerLabel")}
        </label>
        {/* Native select: agent policy form keeps SelectField for native dense editor rows. */}
        <SelectField
          id="task-agent-trigger"
          value={formState.triggerMode}
          onChange={(e) => patchPolicy({ triggerMode: e.target.value as AgentTriggerMode })}
          data-testid="task-agent-trigger"
        >
          {TRIGGER_OPTIONS.map(({ value, key }) => (
            <option key={value} value={value}>
              {t(key)}
            </option>
          ))}
        </SelectField>
      </div>

      <fieldset className="m-0 flex flex-col gap-xs border-0 p-0">
        <legend className={formLabelClass}>{t("tasks:agent.capsLabel")}</legend>
        <div className="flex flex-wrap items-center gap-sm">
          <label className="flex items-center gap-sm text-caption">
            <input
              type="checkbox"
              checked={formState.capCalendarRead ?? true}
              onChange={(e) => patchPolicy({ capCalendarRead: e.target.checked })}
              data-testid="task-agent-cap-calendar-read"
            />
            {t("tasks:agent.caps.calendarRead")}
          </label>
          <label className="flex items-center gap-sm text-caption">
            <input
              type="checkbox"
              checked={formState.capReadAnalysisEvents ?? true}
              onChange={(e) => patchPolicy({ capReadAnalysisEvents: e.target.checked })}
              data-testid="task-agent-cap-read-analysis-events"
            />
            {t("tasks:agent.caps.readAnalysisEvents")}
          </label>
          <label className="flex items-center gap-sm text-caption">
            <input
              type="checkbox"
              checked={formState.capReadItems ?? true}
              onChange={(e) => patchPolicy({ capReadItems: e.target.checked })}
              data-testid="task-agent-cap-read-items"
            />
            {t("tasks:agent.caps.readItems")}
          </label>
          <label className="flex items-center gap-sm text-caption">
            <input
              type="checkbox"
              checked={formState.capWebSearch || formState.capForceWebSearch}
              onChange={(e) =>
                patchPolicy({
                  capWebSearch: e.target.checked,
                  capForceWebSearch: e.target.checked,
                })
              }
              data-testid="task-agent-cap-web-search"
            />
            {t("tasks:agent.caps.webSearch")}
          </label>
        </div>
      </fieldset>

      <fieldset className="m-0 flex flex-col gap-xs border-0 p-0">
        <legend className={formLabelClass}>{t("tasks:agent.outputLabel")}</legend>
        <div className="flex flex-wrap items-center gap-sm">
          <label className="flex items-center gap-sm text-caption">
            <input
              type="checkbox"
              checked={formState.outputCalendar}
              onChange={(e) => patchPolicy({ outputCalendar: e.target.checked })}
              data-testid="task-agent-output-calendar"
            />
            {t("tasks:agent.output.calendar")}
          </label>
          <label className="flex items-center gap-sm text-caption">
            <input
              type="checkbox"
              checked={formState.outputAnalysisEvents}
              disabled={formState.triggerMode === "message_cursor"}
              onChange={(e) => patchPolicy({ outputAnalysisEvents: e.target.checked })}
              data-testid="task-agent-output-analysis"
            />
            {t("tasks:agent.output.analysisEvents")}
          </label>
        </div>
        <p className={`m-0 ${formHelpClass}`}>
          {formState.triggerMode === "message_cursor"
            ? t("tasks:agent.outputHintCursor")
            : t("tasks:agent.outputHint")}
        </p>
      </fieldset>
    </div>
  );
}
