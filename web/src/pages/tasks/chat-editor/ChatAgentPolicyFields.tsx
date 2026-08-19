/**
 * Agent preset + trigger / capability fields for ChatEditorForm.
 * Calendar write (`outputCalendar`) lives in ChatOutputFields (agent-only).
 */
import { useTranslation } from "react-i18next";
import { formHelpClass, formLabelClass } from "../../../components/ui/pageTypography";
import { Button, SelectTile, SelectTileGrid } from "../../../components/ui";
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

const TRIGGER_OPTIONS: {
  value: AgentTriggerMode;
  labelKey: string;
  hintKey: string;
}[] = [
  {
    value: "schedule",
    labelKey: "tasks:agent.trigger.schedule",
    hintKey: "tasks:agent.trigger.scheduleHint",
  },
  {
    value: "message_cursor",
    labelKey: "tasks:agent.trigger.message_cursor",
    hintKey: "tasks:agent.trigger.message_cursorHint",
  },
  {
    value: "message_threshold",
    labelKey: "tasks:agent.trigger.message_threshold",
    hintKey: "tasks:agent.trigger.message_thresholdHint",
  },
];

const CAP_OPTIONS: {
  testId: string;
  labelKey: string;
  hintKey: string;
  active: (form: TaskFormState) => boolean;
  patch: (form: TaskFormState) => Partial<AgentTaskPolicy>;
}[] = [
  {
    testId: "task-agent-cap-calendar-read",
    labelKey: "tasks:agent.caps.calendarRead",
    hintKey: "tasks:agent.caps.calendarReadHint",
    active: (form) => form.capCalendarRead ?? true,
    patch: (form) => ({ capCalendarRead: !(form.capCalendarRead ?? true) }),
  },
  {
    testId: "task-agent-cap-read-analysis-events",
    labelKey: "tasks:agent.caps.readAnalysisEvents",
    hintKey: "tasks:agent.caps.readAnalysisEventsHint",
    active: (form) => form.capReadAnalysisEvents ?? true,
    patch: (form) => ({
      capReadAnalysisEvents: !(form.capReadAnalysisEvents ?? true),
    }),
  },
  {
    testId: "task-agent-cap-read-items",
    labelKey: "tasks:agent.caps.readItems",
    hintKey: "tasks:agent.caps.readItemsHint",
    active: (form) => form.capReadItems ?? true,
    patch: (form) => ({ capReadItems: !(form.capReadItems ?? true) }),
  },
  {
    testId: "task-agent-cap-web-search",
    labelKey: "tasks:agent.caps.webSearch",
    hintKey: "tasks:agent.caps.webSearchHint",
    active: (form) => form.capWebSearch || form.capForceWebSearch,
    patch: (form) => {
      const next = !(form.capWebSearch || form.capForceWebSearch);
      return { capWebSearch: next, capForceWebSearch: next };
    },
  },
];

function useAgentPolicyActions({
  formState,
  updateField,
}: ChatAgentPolicyFieldsProps) {
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

  return { applyPreset, patchPolicy };
}

export function ChatAgentTriggerFields({
  formState,
  updateField,
}: ChatAgentPolicyFieldsProps) {
  const { t } = useTranslation("common");
  const { patchPolicy } = useAgentPolicyActions({ formState, updateField });

  return (
    <div
      className="md:col-span-2 flex flex-col gap-xs"
      role="radiogroup"
      aria-label={t("tasks:agent.triggerLabel")}
      data-testid="task-agent-trigger"
    >
      <span className={formLabelClass}>{t("tasks:agent.triggerLabel")}</span>
      <SelectTileGrid columns="1fr" className="gap-sm">
        {TRIGGER_OPTIONS.map(({ value, labelKey, hintKey }) => {
          const selected = formState.triggerMode === value;
          return (
            <SelectTile
              key={value}
              compact
              active={selected}
              aria-pressed={selected}
              data-testid={`task-agent-trigger-${value}`}
              aria-label={t(labelKey)}
              hint={t(hintKey)}
              onClick={() => patchPolicy({ triggerMode: value })}
            >
              {t(labelKey)}
            </SelectTile>
          );
        })}
      </SelectTileGrid>
    </div>
  );
}

export function ChatAgentSkillsFields({
  formState,
  updateField,
}: ChatAgentPolicyFieldsProps) {
  const { t } = useTranslation("common");
  const { applyPreset, patchPolicy } = useAgentPolicyActions({ formState, updateField });

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-xs">
        <span className={formLabelClass}>{t("tasks:agent.presetsLabel")}</span>
        <div className="flex flex-wrap gap-sm">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="task-agent-preset-project"
            onClick={() => applyPreset(AGENT_PRESET_PROJECT_RECONCILE)}
          >
            {t("tasks:agent.presets.project_reconcile")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="task-agent-preset-web"
            onClick={() => applyPreset(AGENT_PRESET_WEB_SCOUT)}
          >
            {t("tasks:agent.presets.web_scout")}
          </Button>
        </div>
        <p className={`m-0 ${formHelpClass}`}>{t("tasks:agent.presetsHint")}</p>
      </div>

      <fieldset className="m-0 flex flex-col gap-xs border-0 p-0">
        <legend className={formLabelClass}>{t("tasks:agent.capsLabel")}</legend>
        <SelectTileGrid columns="repeat(2, minmax(0, 1fr))" className="gap-sm">
          {CAP_OPTIONS.map((cap) => (
            <SelectTile
              key={cap.testId}
              compact
              variant="toggle"
              active={cap.active(formState)}
              data-testid={cap.testId}
              aria-label={t(cap.labelKey)}
              hint={t(cap.hintKey)}
              onClick={() => patchPolicy(cap.patch(formState))}
            >
              {t(cap.labelKey)}
            </SelectTile>
          ))}
        </SelectTileGrid>
      </fieldset>
    </div>
  );
}

/** Presets + trigger + caps in one block (unit tests). */
export function ChatAgentPolicyFields(props: ChatAgentPolicyFieldsProps) {
  return (
    <div className="md:col-span-2 flex flex-col gap-md" data-testid="task-agent-policy">
      <ChatAgentSkillsFields {...props} />
      <ChatAgentTriggerFields {...props} />
    </div>
  );
}
