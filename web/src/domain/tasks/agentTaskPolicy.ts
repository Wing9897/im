/**
 * Agent task policy — FE mirror of `server/domain/agent_task_spec.py`.
 */

export type AgentTriggerMode = "schedule" | "message_cursor" | "message_threshold";

export type AgentPresetId = "project_reconcile" | "web_scout" | "pure_web_search";

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
export const AGENT_PRESET_PURE_WEB_SEARCH: AgentPresetId = "pure_web_search";

export const AGENT_MODE_CARD_IDS: readonly AgentPresetId[] = [
  AGENT_PRESET_PROJECT_RECONCILE,
  AGENT_PRESET_WEB_SCOUT,
  AGENT_PRESET_PURE_WEB_SEARCH,
];

/** Catalog template id → editor Agent mode card (prompt lives in the catalog). */
export const CATALOG_AGENT_PRESET_ID: Record<string, AgentPresetId> = {
  "agent-work-shift": AGENT_PRESET_PROJECT_RECONCILE,
  "agent-project-schedule": AGENT_PRESET_PROJECT_RECONCILE,
  "agent-source-verify": AGENT_PRESET_WEB_SCOUT,
  "agent-pure-web-search": AGENT_PRESET_PURE_WEB_SEARCH,
};

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
  if (preset === AGENT_PRESET_PURE_WEB_SEARCH) {
    return normalizeAgentPolicy({
      triggerMode: "schedule",
      capCalendarRead: true,
      capCalendarWrites: false,
      capWebSearch: true,
      capForceWebSearch: true,
      capReadAnalysisEvents: true,
      capReadItems: true,
      outputCalendar: false,
      outputAnalysisEvents: true,
    }, { hasChannels: false });
  }
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

/** Policy + form side-effects when the user picks an Agent mode card. */
export function agentPresetFormPatch(preset: AgentPresetId): {
  policy: AgentTaskPolicy;
  clearChannels: boolean;
  setWaveInterval: boolean;
} {
  if (preset === AGENT_PRESET_PURE_WEB_SEARCH) {
    return {
      policy: agentPresetPolicy(preset, { hasChannels: false }),
      clearChannels: true,
      setWaveInterval: false,
    };
  }
  if (preset === AGENT_PRESET_WEB_SCOUT) {
    return {
      policy: agentPresetPolicy(preset, { hasChannels: true }),
      clearChannels: false,
      setWaveInterval: false,
    };
  }
  return {
    policy: agentPresetPolicy(preset, { hasChannels: true }),
    clearChannels: false,
    setWaveInterval: true,
  };
}

export function inferAgentPreset(
  policy: AgentTaskPolicy,
  opts?: { hasChannels?: boolean },
): AgentPresetId | null {
  const hasChannels = opts?.hasChannels ?? false;
  if (
    policy.triggerMode === "message_cursor" &&
    policy.outputCalendar &&
    !policy.outputAnalysisEvents &&
    !policy.capWebSearch
  ) {
    return AGENT_PRESET_PROJECT_RECONCILE;
  }
  if (policy.capWebSearch && policy.outputAnalysisEvents && !policy.outputCalendar) {
    if (policy.triggerMode === "message_threshold") return AGENT_PRESET_WEB_SCOUT;
    if (policy.triggerMode === "schedule") {
      return hasChannels ? AGENT_PRESET_WEB_SCOUT : AGENT_PRESET_PURE_WEB_SEARCH;
    }
  }
  return null;
}

export function normalizeAgentPolicy(
  input: Partial<AgentTaskPolicy>,
  opts?: { hasChannels?: boolean | null },
): AgentTaskPolicy {
  let triggerMode = input.triggerMode ?? "schedule";
  const capCalendarRead = input.capCalendarRead ?? true;
  let capCalendarWrites = input.capCalendarWrites ?? false;
  let capWebSearch = input.capWebSearch ?? false;
  let capForceWebSearch = input.capForceWebSearch ?? false;
  const capReadAnalysisEvents = input.capReadAnalysisEvents ?? true;
  const capReadItems = input.capReadItems ?? true;
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
  return policy.triggerMode === "message_cursor" || policy.triggerMode === "message_threshold";
}

export function agentChannelsOptional(_policy: AgentTaskPolicy): boolean {
  return false;
}

export function agentShowsMessageGateOverrides(policy: AgentTaskPolicy, channelCount: number): boolean {
  return policy.triggerMode === "message_threshold" && channelCount > 0;
}

export function agentShowsWaveInterval(policy: AgentTaskPolicy): boolean {
  return policy.triggerMode === "message_cursor";
}
