import type { AnalysisMode, TaskAnalysisTimeRange } from "./common";

/** Schedule type options for task scheduling */
export type ScheduleType = "seconds_10" | "hourly" | "daily" | "weekly" | "custom_seconds";

/**
 * Base form fields shared by ChatEditor / task create-edit forms.
 * Common set of fields for task creation and editing.
 */
export interface BaseTaskFormFields {
  taskName: string;
  taskDescription: string;
  promptTemplate: string;
  analysisMode: AnalysisMode;
  analysisTimeRange: TaskAnalysisTimeRange;
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
  /**
   * Canonical trigger-purpose RRULE sent to the API.
   * Kept in sync with scheduleType/scheduleValue for presets; preserves
   * unmappable server RRULEs so save does not silently overwrite them.
   */
  scheduleRrule: string | null;
  /** Agent wave cool-down seconds; null → 20 at runtime. */
  agentWaveIntervalSeconds: number | null;
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
  /** Agent-mode policy fields (ignored unless analysisMode=agent). */
  triggerMode: "schedule" | "message_cursor" | "message_threshold";
  capCalendarRead: boolean;
  capCalendarWrites: boolean;
  capWebSearch: boolean;
  capForceWebSearch: boolean;
  capReadAnalysisEvents: boolean;
  capReadItems: boolean;
  outputCalendar: boolean;
  outputAnalysisEvents: boolean;
}
