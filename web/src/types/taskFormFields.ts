import type { AnalysisMode, AnalysisTimeRange } from "./common";

/** Schedule type options for task scheduling */
export type ScheduleType = "seconds_10" | "hourly" | "daily" | "weekly" | "custom_seconds";

/**
 * Base form fields shared between dialog and editor task forms.
 * Provides the common set of fields for task creation/editing.
 */
export interface BaseTaskFormFields {
  taskName: string;
  taskDescription: string;
  promptTemplate: string;
  analysisMode: AnalysisMode;
  analysisTimeRange: AnalysisTimeRange;
  channelIds: string[];
  rrule: string;
  eventStartTime: string;
  eventEndTime: string;
  eventIsAllDay: boolean;
  eventLocation: string;
  eventDescription: string;
  includeInTimeline: boolean;
  /** Optional ownership dimension; `null` = unassigned. */
  worksetId?: string | null;
}

/**
 * ChatEditor / task-form state (SoT for domain + hooks).
 *
 * Extends BaseTaskFormFields (with field-name adaptations) and adds
 * editor-specific fields: scheduleType, scheduleValue.
 *
 * Field mapping from BaseTaskFormFields:
 *   taskName        → name
 *   taskDescription → description
 *   channelIds      → channelIds (same)
 */
export interface TaskFormState
  extends Omit<BaseTaskFormFields, "taskName" | "taskDescription"> {
  name: string;
  description: string;
  scheduleType: ScheduleType;
  scheduleValue: string | null;
  /** Project wave cool-down seconds; null → 20 at runtime. */
  projectWaveIntervalSeconds: number | null;
  /** Event batch overlap; null → 0 (no overlap). Event tasks only. */
  batchOverlapCount: number | null;
  /** Trigger threshold; null = follow global AI Settings. */
  analysisTriggerThreshold: number | null;
  /** Batch message limit; null = follow global AI Settings. */
  analysisBatchMessageLimit: number | null;
  /** Evidence style; null = follow global AI Settings. */
  analysisStrategyMode: "conservative" | "balanced" | "aggressive" | null;
  /** Optional workset ownership; null = unassigned. */
  worksetId: string | null;
}
