/**
 * Agent task policy — FE mirror of `server/domain/agent_task_spec.py`.
 */

export type AgentTriggerMode = "schedule" | "message_cursor" | "message_threshold";

export type AgentPresetId = "project_reconcile" | "web_scout";

export type AgentTaskPolicy = {
  triggerMode: AgentTriggerMode;
  capCalendarRead: boolean;
  capCalendarWrites: boolean;
  capWebSearch: boolean;
  capForceWebSearch: boolean;
  capReadAnalysisEvents: boolean;
  capReadItems: boolean;
  outputCalendar: boolean;
  outputAnalysisEvents: boolean;
};

export const AGENT_PRESET_PROJECT_RECONCILE: AgentPresetId = "project_reconcile";
export const AGENT_PRESET_WEB_SCOUT: AgentPresetId = "web_scout";

export const DEFAULT_AGENT_POLICY: AgentTaskPolicy = {
  triggerMode: "message_cursor",
  capCalendarRead: true,
  capCalendarWrites: true,
  capWebSearch: false,
  capForceWebSearch: false,
  capReadAnalysisEvents: true,
  capReadItems: true,
  outputCalendar: true,
  outputAnalysisEvents: false,
};

export function agentPresetPolicy(
  preset: AgentPresetId,
  opts?: { hasChannels?: boolean },
): AgentTaskPolicy {
  const hasChannels = opts?.hasChannels ?? false;
  if (preset === AGENT_PRESET_WEB_SCOUT) {
    return normalizeAgentPolicy({
      triggerMode: hasChannels ? "message_threshold" : "schedule",
      capCalendarRead: true,
      capCalendarWrites: false,
      capWebSearch: true,
      capForceWebSearch: true,
      capReadAnalysisEvents: true,
      capReadItems: true,
      outputCalendar: false,
      outputAnalysisEvents: true,
    }, { hasChannels });
  }
  return normalizeAgentPolicy({
    triggerMode: "message_cursor",
    capCalendarRead: true,
    capCalendarWrites: true,
    capWebSearch: false,
    capForceWebSearch: false,
    capReadAnalysisEvents: true,
    capReadItems: true,
    outputCalendar: true,
    outputAnalysisEvents: false,
  }, { hasChannels: hasChannels || true });
}

export function normalizeAgentPolicy(
  input: Partial<AgentTaskPolicy>,
  opts?: { hasChannels?: boolean | null },
): AgentTaskPolicy {
  let triggerMode = input.triggerMode ?? "schedule";
  let capCalendarRead = input.capCalendarRead ?? true;
  let capCalendarWrites = input.capCalendarWrites ?? false;
  let capWebSearch = input.capWebSearch ?? false;
  let capForceWebSearch = input.capForceWebSearch ?? false;
  let capReadAnalysisEvents = input.capReadAnalysisEvents ?? true;
  let capReadItems = input.capReadItems ?? true;
  let outputCalendar = input.outputCalendar ?? false;
  let outputAnalysisEvents = input.outputAnalysisEvents ?? false;

  if (outputCalendar) capCalendarWrites = true;
  else capCalendarWrites = false;

  // Merged UX: either web flag implies both (force = search for agent ticks).
  const webOn = capWebSearch || capForceWebSearch;
  capWebSearch = webOn;
  capForceWebSearch = webOn;

  if (triggerMode === "message_threshold" && opts?.hasChannels === false) {
    triggerMode = "schedule";
  }

  // Cursor drain is calendar-reconcile only (matches server normalize_agent_task_spec).
  if (triggerMode === "message_cursor" && outputAnalysisEvents) {
    outputAnalysisEvents = false;
    if (!outputCalendar) {
      outputCalendar = true;
      capCalendarWrites = true;
    }
  }

  if (!outputCalendar && !outputAnalysisEvents) {
    // Keep one output so the form stays saveable; prefer calendar for cursor preset.
    if (triggerMode === "message_cursor") outputCalendar = true;
    else outputAnalysisEvents = true;
    if (outputCalendar) capCalendarWrites = true;
  }

  return {
    triggerMode,
    capCalendarRead,
    capCalendarWrites,
    capWebSearch,
    capForceWebSearch,
    capReadAnalysisEvents,
    capReadItems,
    outputCalendar,
    outputAnalysisEvents,
  };
}

export function agentChannelsRequired(policy: AgentTaskPolicy): boolean {
  return policy.triggerMode === "message_cursor";
}

export function agentChannelsOptional(policy: AgentTaskPolicy): boolean {
  return policy.triggerMode === "message_threshold" || policy.triggerMode === "schedule";
}

export function agentShowsMessageGateOverrides(policy: AgentTaskPolicy, channelCount: number): boolean {
  return policy.triggerMode === "message_threshold" && channelCount > 0;
}

export function agentShowsWaveInterval(policy: AgentTaskPolicy): boolean {
  return policy.triggerMode === "message_cursor";
}
