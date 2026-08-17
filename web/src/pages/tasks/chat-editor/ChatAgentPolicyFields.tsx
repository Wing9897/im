/**
 * Agent preset + trigger / capability fields for ChatEditorForm.
 * Calendar write (`outputCalendar`) lives in ChatOutputFields (agent-only).
 */
import { useTranslation } from "react-i18next";
import { formHelpClass, formLabelClass } from "../../../components/ui/pageTypography";
import { SelectField, SelectTile, SelectTileGrid } from "../../../components/ui";
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

export function applyAgentPolicyFields(
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
    applyAgentPolicyFields(updateField, next);
    if (preset === AGENT_PRESET_PROJECT_RECONCILE && formState.agentWaveIntervalSeconds == null) {
      updateField("agentWaveIntervalSeconds", 20);
    }
  };

  const patchPolicy = (patch: Partial<AgentTaskPolicy>) => {
    const next = normalizeAgentPolicy(
      { ...policyFromForm(formState), ...patch },
      { hasChannels },
    );
    applyAgentPolicyFields(updateField, next);
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

      <div className="flex min-w-0 items-center gap-md">
        <label className={`${formLabelClass} mb-0 min-w-0 flex-1`} htmlFor="task-agent-trigger">
          {t("tasks:agent.triggerLabel")}
        </label>
        {/* Native select: agent policy form keeps SelectField for native dense editor rows. */}
        <SelectField
          id="task-agent-trigger"
          wrapperClassName="w-[16rem] max-w-full shrink-0"
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
        <SelectTileGrid columns="repeat(auto-fit, minmax(148px, 1fr))" className="gap-sm">
          <SelectTile
            compact
            variant="toggle"
            active={formState.capCalendarRead ?? true}
            data-testid="task-agent-cap-calendar-read"
            aria-label={t("tasks:agent.caps.calendarRead")}
            onClick={() => patchPolicy({ capCalendarRead: !(formState.capCalendarRead ?? true) })}
          >
            {t("tasks:agent.caps.calendarRead")}
          </SelectTile>
          <SelectTile
            compact
            variant="toggle"
            active={formState.capReadAnalysisEvents ?? true}
            data-testid="task-agent-cap-read-analysis-events"
            aria-label={t("tasks:agent.caps.readAnalysisEvents")}
            onClick={() =>
              patchPolicy({ capReadAnalysisEvents: !(formState.capReadAnalysisEvents ?? true) })
            }
          >
            {t("tasks:agent.caps.readAnalysisEvents")}
          </SelectTile>
          <SelectTile
            compact
            variant="toggle"
            active={formState.capReadItems ?? true}
            data-testid="task-agent-cap-read-items"
            aria-label={t("tasks:agent.caps.readItems")}
            onClick={() => patchPolicy({ capReadItems: !(formState.capReadItems ?? true) })}
          >
            {t("tasks:agent.caps.readItems")}
          </SelectTile>
          <SelectTile
            compact
            variant="toggle"
            active={formState.capWebSearch || formState.capForceWebSearch}
            data-testid="task-agent-cap-web-search"
            aria-label={t("tasks:agent.caps.webSearch")}
            onClick={() => {
              const next = !(formState.capWebSearch || formState.capForceWebSearch);
              patchPolicy({
                capWebSearch: next,
                capForceWebSearch: next,
              });
            }}
          >
            {t("tasks:agent.caps.webSearch")}
          </SelectTile>
        </SelectTileGrid>
      </fieldset>
    </div>
  );
}
