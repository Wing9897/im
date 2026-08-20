/**
 * Agent mode cards + trigger / capability fields for ChatEditorForm.
 * Calendar write (`outputCalendar`) lives in ChatOutputFields (agent-only).
 */
import { useTranslation } from "react-i18next";
import { formHelpClass, formLabelClass } from "../../../components/ui/pageTypography";
import { SelectTile, SelectTileGrid } from "../../../components/ui";
import { DEFAULT_AGENT_WAVE_INTERVAL_SECONDS } from "../../../domain/tasks/scheduleDefaults";
import { isUnmappedTriggerSchedule } from "../../../domain/tasks/triggerSchedule";
import {
  AGENT_MODE_CARD_IDS,
  agentPresetFormPatch,
  inferAgentPreset,
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
    const patch = agentPresetFormPatch(preset);
    applyAgentPolicyFields(updateField, patch.policy);
    if (patch.clearChannels) {
      updateField("channelIds", []);
    }
    if (patch.setWaveInterval && formState.agentWaveIntervalSeconds == null) {
      updateField("agentWaveIntervalSeconds", DEFAULT_AGENT_WAVE_INTERVAL_SECONDS);
    }
    if (
      formState.scheduleType === "seconds_10" &&
      !isUnmappedTriggerSchedule(
        formState.scheduleType,
        formState.scheduleValue,
        formState.scheduleRrule,
      )
    ) {
      updateField("scheduleType", "hourly");
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

/** Three equal Agent work-mode cards (identity step, after 任務類型). */
export function ChatAgentModeCards({
  formState,
  updateField,
}: ChatAgentPolicyFieldsProps) {
  const { t } = useTranslation("common");
  const { applyPreset } = useAgentPolicyActions({ formState, updateField });
  const selected = inferAgentPreset(policyFromForm(formState), {
    hasChannels: formState.channelIds.length > 0,
  });

  return (
    <div
      className="md:col-span-2 flex flex-col gap-xs"
      role="radiogroup"
      aria-label={t("tasks:agent.modesLabel")}
      data-testid="task-agent-mode-cards"
    >
      <span className={formLabelClass}>{t("tasks:agent.modesLabel")}</span>
      <SelectTileGrid columns="repeat(auto-fit, minmax(148px, 1fr))" className="gap-sm">
        {AGENT_MODE_CARD_IDS.map((id) => {
          const active = selected === id;
          return (
            <SelectTile
              key={id}
              compact
              active={active}
              aria-pressed={active}
              data-testid={`task-agent-mode-${id}`}
              aria-label={t(`tasks:agent.modes.${id}.name`)}
              hint={t(`tasks:agent.modes.${id}.hint`)}
              onClick={() => applyPreset(id)}
            >
              {t(`tasks:agent.modes.${id}.name`)}
            </SelectTile>
          );
        })}
      </SelectTileGrid>
      <p className={`m-0 ${formHelpClass}`}>{t("tasks:agent.modesHint")}</p>
    </div>
  );
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
  const { patchPolicy } = useAgentPolicyActions({ formState, updateField });

  return (
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
  );
}

/** Mode cards + trigger + caps in one block (unit tests). */
export function ChatAgentPolicyFields(props: ChatAgentPolicyFieldsProps) {
  return (
    <div className="md:col-span-2 flex flex-col gap-md" data-testid="task-agent-policy">
      <ChatAgentModeCards {...props} />
      <ChatAgentSkillsFields {...props} />
      <ChatAgentTriggerFields {...props} />
    </div>
  );
}
