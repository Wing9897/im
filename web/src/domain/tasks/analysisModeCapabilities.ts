/**
 * Analysis-mode capabilities — FE mirror of `server/domain/analysis_modes.py`.
 *
 * Keep flags in lockstep with `AnalysisModeSpec` (drift-tested in
 * `server/tests/test_backend_consolidation.py`). Pipeline / capability
 * changes belong on the server Spec first, then here.
 */

export const ANALYSIS_MODE_ORDER = [
  "leaderboard",
  "intel_event",
  "web_intel",
  "recurring",
  "project",
] as const;

export type AnalysisMode = (typeof ANALYSIS_MODE_ORDER)[number];

export type AnalysisPipeline =
  | "message_batch"
  | "project_tick"
  | "web_intel_tick"
  | "rrule_expand";

export type AnalysisModeCapabilities = {
  ai: boolean;
  schedulable: boolean;
  messageBatch: boolean;
  timelineOwning: boolean;
  pipeline: AnalysisPipeline;
};

export const ANALYSIS_MODE_CAPABILITIES: Record<AnalysisMode, AnalysisModeCapabilities> = {
  leaderboard: {
    ai: true,
    schedulable: true,
    messageBatch: true,
    timelineOwning: false,
    pipeline: "message_batch",
  },
  intel_event: {
    ai: true,
    schedulable: true,
    messageBatch: true,
    timelineOwning: true,
    pipeline: "message_batch",
  },
  web_intel: {
    ai: true,
    schedulable: true,
    messageBatch: false,
    timelineOwning: true,
    pipeline: "web_intel_tick",
  },
  recurring: {
    ai: false,
    schedulable: false,
    messageBatch: false,
    timelineOwning: true,
    pipeline: "rrule_expand",
  },
  project: {
    ai: true,
    schedulable: true,
    messageBatch: false,
    timelineOwning: true,
    pipeline: "project_tick",
  },
};

export function isAnalysisMode(value: string | null | undefined): value is AnalysisMode {
  return value != null && Object.prototype.hasOwnProperty.call(ANALYSIS_MODE_CAPABILITIES, value);
}

export function getAnalysisModeCapabilities(
  mode: string | null | undefined,
): AnalysisModeCapabilities | null {
  if (!isAnalysisMode(mode)) return null;
  return ANALYSIS_MODE_CAPABILITIES[mode];
}

/** RRULE editor fields (recurring pipeline only). */
export function analysisModeShowsRruleFields(mode: AnalysisMode): boolean {
  return ANALYSIS_MODE_CAPABILITIES[mode].pipeline === "rrule_expand";
}

/** Schedule-only buckets hide prompt + channel pickers. */
export function analysisModeHidesPromptAndChannel(mode: AnalysisMode): boolean {
  return !ANALYSIS_MODE_CAPABILITIES[mode].schedulable;
}

/** Modes that bind local collector channels as analysis input. */
export function analysisModeRequiresChannels(mode: AnalysisMode): boolean {
  const caps = ANALYSIS_MODE_CAPABILITIES[mode];
  return caps.messageBatch || caps.pipeline === "project_tick";
}

/**
 * web_intel may optionally bind channels (message-gate + source verify).
 * Do not fold this into ``messageBatch`` — tick stays on ``web_intel_tick``.
 */
export function analysisModeShowsOptionalChannels(mode: AnalysisMode): boolean {
  return ANALYSIS_MODE_CAPABILITIES[mode].pipeline === "web_intel_tick";
}

/** web_intel pipeline (Agent multi-round; no dedicated search-query field). */
export function analysisModeIsWebIntel(mode: AnalysisMode): boolean {
  return ANALYSIS_MODE_CAPABILITIES[mode].pipeline === "web_intel_tick";
}

/** web_intel with bound channels → message-gate threshold / batch overrides. */
export function webIntelMessageGateActive(
  mode: AnalysisMode,
  channelIds: readonly string[],
): boolean {
  return analysisModeShowsOptionalChannels(mode) && channelIds.length > 0;
}

export function isTimelineAssignableAnalysisMode(mode: string | null | undefined): boolean {
  return getAnalysisModeCapabilities(mode)?.timelineOwning === true;
}

export function isScheduleOnlyAnalysisMode(mode: AnalysisMode): boolean {
  return !ANALYSIS_MODE_CAPABILITIES[mode].schedulable;
}

/** Builtin task-template presets — AI / schedulable modes only. */
export function analysisModeSupportsTaskPresets(mode: AnalysisMode): boolean {
  return ANALYSIS_MODE_CAPABILITIES[mode].schedulable;
}

/**
 * Modes that persist findings into ``analysis_events`` (Intelligence feed /
 * Timeline analysis layer / Board event widgets).
 */
export const ANALYSIS_EVENTS_MODES = ["intel_event", "web_intel"] as const;
export type AnalysisEventsMode = (typeof ANALYSIS_EVENTS_MODES)[number];

export function isAnalysisEventsMode(
  mode: string | null | undefined,
): mode is AnalysisEventsMode {
  return mode === "intel_event" || mode === "web_intel";
}
