import type { TaskSchedule, TaskScheduleConfig } from "../../api/taskSchedule";
import type {
  AnalysisMode,
  AnalysisTask,
  TaskConfig,
  TaskDraftPayload,
  TaskFormState,
} from "../../types";
import {
  analysisModeHidesPromptAndChannel,
  analysisModeShowsRruleFields,
} from "./analysisModeCapabilities";
import { safeArray } from "../../utils/nullGuards";

/** Applies a partial task config onto an existing form state (AI preset / assistant). */
export function applyConfigToFormState(
  base: TaskFormState,
  config: Partial<TaskFormState>,
): TaskFormState {
  const updated = { ...base };

  if (config.name !== undefined) updated.name = config.name;
  if (config.description !== undefined) updated.description = config.description;
  if (config.promptTemplate !== undefined) updated.promptTemplate = config.promptTemplate;
  if (config.scheduleType !== undefined) updated.scheduleType = config.scheduleType;
  if (config.scheduleValue !== undefined) updated.scheduleValue = config.scheduleValue;
  if (config.analysisMode !== undefined) updated.analysisMode = config.analysisMode;
  if (config.analysisTimeRange !== undefined) updated.analysisTimeRange = config.analysisTimeRange;
  if (config.channelIds !== undefined) updated.channelIds = config.channelIds;
  if (config.includeInTimeline !== undefined) {
    updated.includeInTimeline = config.includeInTimeline;
  }
  if (config.projectWaveIntervalSeconds !== undefined) {
    updated.projectWaveIntervalSeconds = config.projectWaveIntervalSeconds;
  }
  if (config.batchOverlapCount !== undefined) {
    updated.batchOverlapCount = config.batchOverlapCount;
  }
  if (config.analysisTriggerThreshold !== undefined) {
    updated.analysisTriggerThreshold = config.analysisTriggerThreshold;
  }
  if (config.analysisBatchMessageLimit !== undefined) {
    updated.analysisBatchMessageLimit = config.analysisBatchMessageLimit;
  }
  if (config.analysisStrategyMode !== undefined) {
    updated.analysisStrategyMode = config.analysisStrategyMode;
  }

  return updated;
}

/**
 * Builds the TaskConfig payload sent to create/update APIs.
 *
 * This is the mode boundary for recurring-only fields: analysis payloads are
 * built without RRULE/event keys even when stale recurring values remain in the
 * form state after a mode switch. Calendar payloads retain the existing
 * camelCase wire names for recurrence and event presentation fields.
 */
export function formStateToTaskConfig(formState: TaskFormState): TaskConfig {
  const commonConfig = {
    name: formState.name,
    description: formState.description || null,
    analysisMode: formState.analysisMode,
    scheduleType: formState.scheduleType,
    scheduleValue: formState.scheduleValue,
    worksetId: formState.worksetId,
  } satisfies Pick<
    TaskConfig,
    "name" | "description" | "analysisMode" | "scheduleType" | "scheduleValue" | "worksetId"
  >;

  if (formState.analysisMode === "recurring") {
    return {
      ...commonConfig,
      promptTemplate: "",
      channelIds: [],
      // Server also forces calendar → 1; keep client honest for round-trips.
      includeInTimeline: true,
    };
  }

  return {
    ...commonConfig,
    promptTemplate: formState.promptTemplate,
    analysisTimeRange: formState.analysisTimeRange,
    channelIds: formState.channelIds,
    ...(formState.analysisMode === "event" || formState.analysisMode === "project"
      ? { includeInTimeline: formState.includeInTimeline }
      : {}),
    ...(formState.analysisMode === "project"
      ? { projectWaveIntervalSeconds: formState.projectWaveIntervalSeconds }
      : {}),
    ...(formState.analysisMode === "event" || formState.analysisMode === "leaderboard"
      ? {
          batchOverlapCount:
            formState.analysisMode === "event"
              ? (formState.batchOverlapCount ?? 0)
              : null,
          analysisTriggerThreshold: formState.analysisTriggerThreshold,
          analysisBatchMessageLimit: formState.analysisBatchMessageLimit,
          analysisStrategyMode: formState.analysisStrategyMode,
        }
      : {}),
  };
}

/** Builds the schedule subresource payload for recurring tasks. */
export function formStateToTaskSchedule(formState: TaskFormState): TaskScheduleConfig {
  return {
    rrule: formState.rrule.trim(),
    eventStartTime: formState.eventStartTime.trim() || null,
    eventEndTime: formState.eventEndTime.trim() || null,
    eventIsAllDay: formState.eventIsAllDay,
    eventLocation: formState.eventLocation.trim() || null,
    eventDescription: formState.eventDescription.trim() || null,
  };
}

/** Merge schedule fields into form state after GET /tasks/{id}/schedule. */
export function applyScheduleToFormState(
  formState: TaskFormState,
  schedule: TaskSchedule,
): TaskFormState {
  return {
    ...formState,
    rrule: schedule.rrule ?? "",
    eventStartTime: schedule.eventStartTime ?? "",
    eventEndTime: schedule.eventEndTime ?? "",
    eventIsAllDay: schedule.eventIsAllDay ?? false,
    eventLocation: schedule.eventLocation ?? "",
    eventDescription: schedule.eventDescription ?? "",
  };
}

/** Maps a persisted AnalysisTask into ChatEditor form state. */
export function analysisTaskToFormState(task: AnalysisTask): TaskFormState {
  return {
    name: task.name,
    description: task.description ?? "",
    promptTemplate: task.promptTemplate,
    scheduleType: (task.scheduleType ?? "seconds_10") as TaskFormState["scheduleType"],
    scheduleValue: task.scheduleValue ?? null,
    analysisMode: task.analysisMode,
    analysisTimeRange: task.analysisTimeRange,
    channelIds: safeArray(task.channelIds).map((ch) =>
      typeof ch === "string" ? ch : (ch.id ?? `${ch.platform}:${ch.platformId}`),
    ),
    rrule: "",
    eventStartTime: "",
    eventEndTime: "",
    eventIsAllDay: false,
    eventLocation: "",
    eventDescription: "",
    includeInTimeline: task.includeInTimeline ?? true,
    projectWaveIntervalSeconds: task.projectWaveIntervalSeconds ?? null,
    batchOverlapCount: task.batchOverlapCount ?? null,
    analysisTriggerThreshold: task.analysisTriggerThreshold ?? null,
    analysisBatchMessageLimit: task.analysisBatchMessageLimit ?? null,
    analysisStrategyMode:
      task.analysisStrategyMode === "conservative" ||
      task.analysisStrategyMode === "balanced" ||
      task.analysisStrategyMode === "aggressive"
        ? task.analysisStrategyMode
        : null,
    worksetId: task.worksetId ?? null,
  };
}

/** Simulates backend persistence for round-trip property tests. */
function taskConfigToPersistedTask(config: TaskConfig): AnalysisTask {
  const channelIds = (config.channelIds ?? []).map((ch) =>
    typeof ch === "string"
      ? { platform: "telegram", platformId: ch, id: ch }
      : ch,
  );

  return {
    id: "test-id",
    name: config.name,
    description: config.description ?? null,
    promptTemplate: config.promptTemplate,
    analysisMode: config.analysisMode ?? "leaderboard",
    analysisTimeRange: config.analysisTimeRange ?? "24h",
    version: 1,
    isActive: true,
    scheduleType: config.scheduleType ?? "seconds_10",
    scheduleValue: config.scheduleValue ?? null,
    channelIds,
    includeInTimeline: config.includeInTimeline ?? true,
    projectWaveIntervalSeconds: config.projectWaveIntervalSeconds ?? null,
    batchOverlapCount: config.batchOverlapCount ?? null,
    analysisTriggerThreshold: config.analysisTriggerThreshold ?? null,
    analysisBatchMessageLimit: config.analysisBatchMessageLimit ?? null,
    analysisStrategyMode:
      config.analysisStrategyMode === "conservative" ||
      config.analysisStrategyMode === "balanced" ||
      config.analysisStrategyMode === "aggressive"
        ? config.analysisStrategyMode
        : null,
    worksetId: config.worksetId ?? null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
}

export function roundTripFormState(formState: TaskFormState): TaskFormState {
  return analysisTaskToFormState(taskConfigToPersistedTask(formStateToTaskConfig(formState)));
}

/** Payload shape for POST /tasks/chat-assistant currentTask context. */
export function buildCurrentTaskPayload(formState: TaskFormState): TaskDraftPayload {
  return {
    name: formState.name,
    description: formState.description,
    promptTemplate: formState.promptTemplate,
    scheduleType: formState.scheduleType,
    scheduleValue: formState.scheduleValue,
    analysisMode: formState.analysisMode,
    analysisTimeRange: formState.analysisTimeRange,
    channelIds: formState.channelIds,
    includeInTimeline: formState.includeInTimeline,
  };
}

export interface TaskModeFieldVisibility {
  rruleFieldsVisible: boolean;
  promptFieldsVisible: boolean;
  channelFieldsVisible: boolean;
}

/** Field visibility rules for ChatEditorForm by analysis mode. */
export function getTaskModeFieldVisibility(mode: AnalysisMode): TaskModeFieldVisibility {
  const hidesPromptAndChannel = analysisModeHidesPromptAndChannel(mode);
  return {
    rruleFieldsVisible: analysisModeShowsRruleFields(mode),
    promptFieldsVisible: !hidesPromptAndChannel,
    channelFieldsVisible: !hidesPromptAndChannel,
  };
}
