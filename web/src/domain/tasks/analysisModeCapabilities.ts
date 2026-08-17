/**
 * Analysis-mode capabilities — FE mirror of `server/domain/analysis_modes.py`.
 *
 * Keep flags in lockstep with `AnalysisModeSpec` (drift-tested in
 * `server/tests/test_backend_consolidation.py`). Pipeline / capability
 * changes belong on the server Spec first, then here.
 *
 * Recurring calendar series are **not** an analysis mode — see
 * `/api/v1/calendar/recurring` and `RecurringSeries`.
 */

export const ANALYSIS_MODE_ORDER = [
  "leaderboard",
  "intel_event",
  "agent",
] as const;

export type AnalysisMode = (typeof ANALYSIS_MODE_ORDER)[number];

export type AnalysisPipeline = "message_batch" | "agent_tick";

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
  agent: {
    ai: true,
    schedulable: true,
    messageBatch: false,
    timelineOwning: true,
    pipeline: "agent_tick",
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

/** Schedule-only buckets hide prompt + channel pickers. */
export function analysisModeHidesPromptAndChannel(mode: AnalysisMode): boolean {
  return !ANALYSIS_MODE_CAPABILITIES[mode].schedulable;
}

/** Modes that always bind local collector channels as analysis input. */
export function analysisModeRequiresChannels(mode: AnalysisMode): boolean {
  return ANALYSIS_MODE_CAPABILITIES[mode].messageBatch;
}

/** Agent may optionally bind channels (depends on trigger_mode). */
export function analysisModeShowsOptionalChannels(mode: AnalysisMode): boolean {
  return ANALYSIS_MODE_CAPABILITIES[mode].pipeline === "agent_tick";
}

export function analysisModeIsAgent(mode: AnalysisMode): boolean {
  return ANALYSIS_MODE_CAPABILITIES[mode].pipeline === "agent_tick";
}

export function isTimelineAssignableAnalysisMode(mode: string | null | undefined): boolean {
  return getAnalysisModeCapabilities(mode)?.timelineOwning === true;
}

/** Builtin task-template presets — AI / schedulable modes only. */
export function analysisModeSupportsTaskPresets(mode: AnalysisMode): boolean {
  return ANALYSIS_MODE_CAPABILITIES[mode].schedulable;
}

/**
 * Modes that may persist findings into ``analysis_events``.
 * Callers must still honor ``outputAnalysisEvents`` via ``taskWritesAnalysisEvents``.
 */
export const ANALYSIS_EVENTS_MODES = ["intel_event", "agent"] as const;
export type AnalysisEventsMode = (typeof ANALYSIS_EVENTS_MODES)[number];

export function isAnalysisEventsMode(
  mode: string | null | undefined,
): mode is AnalysisEventsMode {
  return mode === "intel_event" || mode === "agent";
}

/**
 * Default for the intelligence-output flag when the wire value is missing.
 * intel_event defaults on; leaderboard and agent stay off (leaderboard still
 * writes the ranking page; agent is opt-in).
 */
export function defaultOutputAnalysisEvents(
  analysisMode: string | null | undefined,
  value?: boolean | null,
): boolean {
  if (value != null) return value;
  return analysisMode === "intel_event";
}

/**
 * Intelligence-page listing filter (`intel_event` / `agent` with output on).
 * Leaderboard never lists here. Not server `task_writes_analysis_events`
 * (analysis_events persist) or `task_persists_findings` (leaderboard topics).
 * Do not merge the three functions.
 */
export function taskWritesAnalysisEvents(task: {
  analysisMode?: string | null;
  outputAnalysisEvents?: boolean | null;
}): boolean {
  if (task.analysisMode === "intel_event") {
    return defaultOutputAnalysisEvents("intel_event", task.outputAnalysisEvents);
  }
  return task.analysisMode === "agent" && Boolean(task.outputAnalysisEvents);
}
