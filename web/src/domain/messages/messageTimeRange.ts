/**
 * Monitor／agent **message query** time windows.
 *
 * Extends task analysis windows with ``12h``／``24h``. Those two tokens are
 * legal for message filters only — they must **not** be written to
 * ``analysis_tasks.analysis_time_range`` (DB CHECK rejects them; use ``1d``／``48h``).
 *
 * FE mirror of ``server/domain/message_time_ranges.py``. See also:
 * ``TaskAnalysisTimeRange`` in ``domain/tasks/taskAnalysisTimeRange``.
 */

import {
  TASK_ANALYSIS_TIME_RANGE_VALUES,
  type TaskAnalysisTimeRange,
} from "../tasks/taskAnalysisTimeRange";

/** Extra message-query tokens not accepted on task ``analysis_time_range``. */
export const MESSAGE_ONLY_TIME_RANGE_VALUES = ["12h", "24h"] as const;

export type MessageOnlyTimeRange = (typeof MESSAGE_ONLY_TIME_RANGE_VALUES)[number];

export const MESSAGE_TIME_RANGE_VALUES = [
  ...TASK_ANALYSIS_TIME_RANGE_VALUES,
  ...MESSAGE_ONLY_TIME_RANGE_VALUES,
] as const;

export type MessageTimeRange = TaskAnalysisTimeRange | MessageOnlyTimeRange;

const MESSAGE_TIME_RANGE_SET = new Set<string>(MESSAGE_TIME_RANGE_VALUES);

export function isMessageTimeRange(value: unknown): value is MessageTimeRange {
  return typeof value === "string" && MESSAGE_TIME_RANGE_SET.has(value);
}
