/**
 * Task ``analysis_time_range`` vocabulary — FE mirror of
 * ``server.db.schema_domains.vocabulary.ANALYSIS_TIME_RANGE_VALUES`` (drift-tested in
 * ``server/tests/test_backend_consolidation.py``).
 *
 * Do **not** add monitor／agent-only tokens ``12h``／``24h`` here — those belong on
 * ``MessageTimeRange`` (use ``1d``／``48h`` on tasks instead).
 */

export const TASK_ANALYSIS_TIME_RANGE_VALUES = [
  "all",
  "today",
  "1h",
  "6h",
  "48h",
  "1d",
  "7d",
  "30d",
] as const;

export type TaskAnalysisTimeRange = (typeof TASK_ANALYSIS_TIME_RANGE_VALUES)[number];

/** Chip / select order: unlimited first, then longest → shortest windows. */
export const TASK_ANALYSIS_TIME_RANGE_CHIP_ORDER: readonly TaskAnalysisTimeRange[] = [
  "all",
  "30d",
  "7d",
  "48h",
  "1d",
  "today",
  "6h",
  "1h",
];

export const TASK_ANALYSIS_TIME_RANGE_I18N_KEYS: Record<TaskAnalysisTimeRange, string> = {
  all: "tasks:editor.timeAll",
  today: "tasks:editor.timeToday",
  "1h": "tasks:editor.time1h",
  "6h": "tasks:editor.time6h",
  "48h": "tasks:editor.time48h",
  "1d": "tasks:editor.time1d",
  "7d": "tasks:editor.time7d",
  "30d": "tasks:editor.time30d",
};

const TASK_ANALYSIS_TIME_RANGE_SET = new Set<string>(TASK_ANALYSIS_TIME_RANGE_VALUES);

export function isTaskAnalysisTimeRange(value: unknown): value is TaskAnalysisTimeRange {
  return typeof value === "string" && TASK_ANALYSIS_TIME_RANGE_SET.has(value);
}
