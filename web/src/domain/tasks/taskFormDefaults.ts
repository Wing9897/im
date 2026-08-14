import type {
  AnalysisTask,
  TaskConfig,
  TaskDraftPayload,
  TaskFormState,
} from "../../types";
import { presetToTriggerRrule, triggerRruleToPreset } from "./triggerSchedule";
import { safeArray } from "../../utils/nullGuards";
import {
  scheduleFieldsFromTask,
  withSyncedTriggerSchedule,
} from "./taskFormSchedule";

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
  if (
    config.scheduleType !== undefined ||
    config.scheduleValue !== undefined ||
    config.scheduleRrule !== undefined
  ) {
    if (config.scheduleRrule !== undefined && config.scheduleType === undefined) {
      const mapped = triggerRruleToPreset(config.scheduleRrule);
      if (mapped) {
        Object.assign(
          updated,
          withSyncedTriggerSchedule({
            ...mapped,
            scheduleRrule: config.scheduleRrule,
          }),
        );
      } else {
        updated.scheduleRrule = config.scheduleRrule;
      }
    } else {
      Object.assign(
        updated,
        withSyncedTriggerSchedule({
          scheduleType: updated.scheduleType,
          scheduleValue: updated.scheduleValue,
          scheduleRrule: updated.scheduleRrule,
        }),
      );
    }
  }
  if (config.analysisMode !== undefined) updated.analysisMode = config.analysisMode;
  if (config.analysisTimeRange !== undefined) updated.analysisTimeRange = config.analysisTimeRange;
  if (config.channelIds !== undefined) updated.channelIds = config.channelIds;
  if (config.includeInTimeline !== undefined) {
    updated.includeInTimeline = config.includeInTimeline;
  }
  if (config.agentWaveIntervalSeconds !== undefined) {
    updated.agentWaveIntervalSeconds = config.agentWaveIntervalSeconds;
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
  if (config.triggerMode !== undefined) updated.triggerMode = config.triggerMode;
  if (config.capCalendarRead !== undefined) updated.capCalendarRead = config.capCalendarRead;
  if (config.capCalendarWrites !== undefined) updated.capCalendarWrites = config.capCalendarWrites;
  if (config.capWebSearch !== undefined) updated.capWebSearch = config.capWebSearch;
  if (config.capForceWebSearch !== undefined) updated.capForceWebSearch = config.capForceWebSearch;
  if (config.capReadAnalysisEvents !== undefined) {
    updated.capReadAnalysisEvents = config.capReadAnalysisEvents;
  }
  if (config.capReadItems !== undefined) updated.capReadItems = config.capReadItems;
  if (config.outputCalendar !== undefined) updated.outputCalendar = config.outputCalendar;
  if (config.outputAnalysisEvents !== undefined) {
    updated.outputAnalysisEvents = config.outputAnalysisEvents;
  }
  if (config.llmProfileId !== undefined) updated.llmProfileId = config.llmProfileId;

  return updated;
}

/**
 * Builds the TaskConfig payload sent to create/update APIs.
 *
 * Calendar recurring fields are not part of task persistence.
 */
export function formStateToTaskConfig(formState: TaskFormState): TaskConfig {
  // Write path SoT: only scheduleRrule. Presets stay in form state for UX.
  const scheduleRrule =
    formState.scheduleRrule?.trim() ||
    presetToTriggerRrule(formState.scheduleType, formState.scheduleValue);
  const llmProfileId = formState.llmProfileId.trim();
  const commonConfig = {
    name: formState.name,
    description: formState.description || null,
    analysisMode: formState.analysisMode,
    scheduleRrule,
    worksetId: formState.worksetId,
  } satisfies Pick<
    TaskConfig,
    "name" | "description" | "analysisMode" | "scheduleRrule" | "worksetId"
  >;

  const messageGate =
    formState.analysisMode === "agent" &&
    formState.triggerMode === "message_threshold" &&
    formState.channelIds.length > 0;

  return {
    ...commonConfig,
    // Omit empty so create can fall back to the oldest complete profile.
    ...(llmProfileId ? { llmProfileId } : {}),
    promptTemplate: formState.promptTemplate,
    analysisTimeRange: formState.analysisTimeRange,
    channelIds: formState.channelIds,
    ...(formState.analysisMode === "intel_event" || formState.analysisMode === "agent"
      ? { includeInTimeline: formState.includeInTimeline }
      : {}),
    ...(formState.analysisMode === "agent"
      ? {
          agentWaveIntervalSeconds: formState.agentWaveIntervalSeconds,
          triggerMode: formState.triggerMode,
          capCalendarRead: formState.capCalendarRead,
          capCalendarWrites: formState.capCalendarWrites,
          capWebSearch: formState.capWebSearch,
          capForceWebSearch: formState.capForceWebSearch,
          capReadAnalysisEvents: formState.capReadAnalysisEvents,
          capReadItems: formState.capReadItems,
          outputCalendar: formState.outputCalendar,
          outputAnalysisEvents: formState.outputAnalysisEvents,
        }
      : {}),
    ...(formState.analysisMode === "intel_event" ||
    formState.analysisMode === "leaderboard" ||
    messageGate
      ? {
          batchOverlapCount:
            formState.analysisMode === "intel_event" || messageGate
              ? (formState.batchOverlapCount ?? 0)
              : null,
          analysisTriggerThreshold: formState.analysisTriggerThreshold,
          analysisBatchMessageLimit: formState.analysisBatchMessageLimit,
          analysisStrategyMode: formState.analysisStrategyMode,
        }
      : {}),
  };
}

/** Maps a persisted AnalysisTask into ChatEditor form state. */
export function analysisTaskToFormState(task: AnalysisTask): TaskFormState {
  const schedule = scheduleFieldsFromTask(task);
  return {
    name: task.name,
    description: task.description ?? "",
    promptTemplate: task.promptTemplate ?? "",
    scheduleType: schedule.scheduleType,
    scheduleValue: schedule.scheduleValue,
    scheduleRrule: schedule.scheduleRrule,
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
    agentWaveIntervalSeconds: task.agentWaveIntervalSeconds ?? null,
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
    llmProfileId: task.llmProfileId ?? "",
    triggerMode:
      task.triggerMode === "message_cursor" ||
      task.triggerMode === "message_threshold" ||
      task.triggerMode === "schedule"
        ? task.triggerMode
        : "schedule",
    capCalendarRead: task.capCalendarRead ?? true,
    capCalendarWrites: task.capCalendarWrites ?? false,
    capWebSearch: task.capWebSearch ?? false,
    capForceWebSearch: task.capForceWebSearch ?? false,
    capReadAnalysisEvents: task.capReadAnalysisEvents ?? true,
    capReadItems: task.capReadItems ?? true,
    outputCalendar: task.outputCalendar ?? false,
    outputAnalysisEvents: task.outputAnalysisEvents ?? false,
  };
}

/** Simulates backend persistence for round-trip property tests. */
function taskConfigToPersistedTask(config: TaskConfig): AnalysisTask {
  const channelIds = (config.channelIds ?? []).map((ch) =>
    typeof ch === "string"
      ? { platform: "telegram", platformId: ch, id: ch }
      : ch,
  );
  const schedule = scheduleFieldsFromTask({
    scheduleRrule: config.scheduleRrule ?? null,
  });

  return {
    id: "test-id",
    name: config.name,
    description: config.description ?? null,
    promptTemplate: config.promptTemplate,
    analysisMode: config.analysisMode ?? "leaderboard",
    analysisTimeRange: config.analysisTimeRange ?? "1d",
    version: 1,
    isActive: true,
    scheduleRrule: schedule.scheduleRrule,
    channelIds,
    includeInTimeline: config.includeInTimeline ?? true,
    agentWaveIntervalSeconds: config.agentWaveIntervalSeconds ?? null,
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
    llmProfileId: config.llmProfileId ?? "",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    triggerMode: config.triggerMode ?? "schedule",
    capCalendarRead: config.capCalendarRead ?? true,
    capCalendarWrites: config.capCalendarWrites ?? false,
    capWebSearch: config.capWebSearch ?? false,
    capForceWebSearch: config.capForceWebSearch ?? false,
    capReadAnalysisEvents: config.capReadAnalysisEvents ?? true,
    capReadItems: config.capReadItems ?? true,
    outputCalendar: config.outputCalendar ?? false,
    outputAnalysisEvents: config.outputAnalysisEvents ?? false,
  };
}

export function roundTripFormState(formState: TaskFormState): TaskFormState {
  return analysisTaskToFormState(taskConfigToPersistedTask(formStateToTaskConfig(formState)));
}

/** Payload shape for agent task-advisor ``currentTask`` context. */
export function buildCurrentTaskPayload(formState: TaskFormState): TaskDraftPayload {
  // Prefer canonical RRULE; presets stay local to the form editor.
  const scheduleRrule =
    formState.scheduleRrule?.trim() ||
    presetToTriggerRrule(formState.scheduleType, formState.scheduleValue);
  return {
    name: formState.name,
    description: formState.description,
    promptTemplate: formState.promptTemplate,
    scheduleRrule,
    analysisMode: formState.analysisMode,
    analysisTimeRange: formState.analysisTimeRange,
    channelIds: formState.channelIds,
    includeInTimeline: formState.includeInTimeline,
  };
}
