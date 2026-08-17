import type { AnalysisMode, TaskAnalysisTimeRange } from "./common";
import type { NotifyPref } from "../domain/notify/notifyPref";

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
  /** Workset ownership; empty/omit → 一般 (`SYSTEM_WORKSET_ID`). */
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
  /** Workset ownership; empty/omit → 一般. */
  worksetId: string;
  /**
   * LLM profile id for this task's connection.
   * Empty on create → backend uses the oldest complete profile (or UI may preselect).
   */
  llmProfileId: string;
  /** Per-task reminder override; omit → follow workset. */
  notifyPref?: NotifyPref;
  /** Agent trigger / capabilities / calendar output (ignored unless analysisMode=agent). */
  triggerMode: "schedule" | "message_cursor" | "message_threshold";
  capCalendarRead: boolean;
  capCalendarWrites: boolean;
  capWebSearch: boolean;
  capForceWebSearch: boolean;
  capReadAnalysisEvents: boolean;
  capReadItems: boolean;
  outputCalendar: boolean;
  /**
   * Write intelligence results (`analysis_events` / leaderboard).
   * All AI modes; Agent + message_cursor cannot enable this.
   */
  outputAnalysisEvents: boolean;
}
