/**
 * Analysis-mode capabilities — FE mirror of `server/domain/analysis_modes.py`.
 *
 * Keep flags in lockstep with `AnalysisModeSpec` (drift-tested in
 * `server/tests/test_backend_consolidation.py`). Pipeline / capability
 * changes belong on the server Spec first, then here.
 */

export const ANALYSIS_MODE_ORDER = [
  "leaderboard",
  "event",
  "recurring",
  "calendar_task",
  "project",
] as const;

export type AnalysisMode = (typeof ANALYSIS_MODE_ORDER)[number];

export type AnalysisPipeline =
  | "message_batch"
  | "project_tick"
  | "rrule_expand"
  | "filter_bucket";

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
  event: {
    ai: true,
    schedulable: true,
    messageBatch: true,
    timelineOwning: true,
    pipeline: "message_batch",
  },
  recurring: {
    ai: false,
    schedulable: false,
    messageBatch: false,
    timelineOwning: true,
    pipeline: "rrule_expand",
  },
  calendar_task: {
    ai: false,
    schedulable: false,
    messageBatch: false,
    timelineOwning: true,
    pipeline: "filter_bucket",
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
