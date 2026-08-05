import type { TaskSchedule, TaskScheduleConfig } from "../../api/taskSchedule";
import type { CreateRecurringTaskConfig } from "../../api/tasks";
import type {
  AnalysisMode,
  AnalysisTask,
  TaskConfig,
  TaskDraftPayload,
  TaskFormState,
} from "../../types";
import {
  analysisModeHidesPromptAndChannel,
  analysisModeIsWebIntel,
  analysisModeRequiresChannels,
  analysisModeShowsOptionalChannels,
  analysisModeShowsRruleFields,
  webIntelMessageGateActive,
} from "./analysisModeCapabilities";
import { presetToTriggerRrule, triggerRruleToPreset } from "./triggerSchedule";
import { safeArray } from "../../utils/nullGuards";

/** Keep canonical scheduleRrule aligned with FE preset fields. */
export function withSyncedTriggerSchedule(
  state: Pick<TaskFormState, "scheduleType" | "scheduleValue" | "scheduleRrule">,
): Pick<TaskFormState, "scheduleType" | "scheduleValue" | "scheduleRrule"> {
  return {
    scheduleType: state.scheduleType,
    scheduleValue: state.scheduleValue,
    scheduleRrule: presetToTriggerRrule(state.scheduleType, state.scheduleValue),
  };
}

/** Resolve FE presets + canonical RRULE from a persisted task wire shape. */
export function scheduleFieldsFromTask(
  task: Pick<AnalysisTask, "scheduleRrule">,
): Pick<TaskFormState, "scheduleType" | "scheduleValue" | "scheduleRrule"> {
  const fromCanonical = triggerRruleToPreset(task.scheduleRrule);
  if (fromCanonical) {
    return withSyncedTriggerSchedule({
      ...fromCanonical,
      scheduleRrule: task.scheduleRrule ?? null,
    });
  }
  // Unmappable RRULE: preserve wire value so save cannot overwrite with seconds_10.
  const preserved = task.scheduleRrule?.trim() || null;
  return {
    scheduleType: "seconds_10",
    scheduleValue: null,
    scheduleRrule: preserved ?? presetToTriggerRrule("seconds_10", null),
  };
}

/** Applies a partial task config onto an existing form state (AI preset / assistant). */
export function applyConfigToFormState(
  base: TaskFormState,
  config: Partial<TaskFormState>,
): TaskFormState {
  const updated = { ...base };

  if (config.name !== undefined) updated.name = config.name;
  if (config.description !== undefined) updated.description = config.description;
  if (config.promptTemplate !== undefined) updated.promptTemplate = config.promptTemplate;
  if (config.webSearchQuery !== undefined) updated.webSearchQuery = config.webSearchQuery;
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
  // Write path SoT: only scheduleRrule. Presets stay in form state for UX.
  const scheduleRrule =
    formState.analysisMode === "recurring"
      ? null
      : formState.scheduleRrule?.trim() ||
        presetToTriggerRrule(formState.scheduleType, formState.scheduleValue);
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

  if (formState.analysisMode === "recurring") {
    return {
      ...commonConfig,
      promptTemplate: "",
      channelIds: [],
      // Server also forces calendar → 1; keep client honest for round-trips.
      includeInTimeline: true,
    };
  }

  const messageGate = webIntelMessageGateActive(
    formState.analysisMode,
    formState.channelIds,
  );

  return {
    ...commonConfig,
    promptTemplate: formState.promptTemplate,
    // web_intel Agent picks keywords from the prompt; never persist a seed field.
    webSearchQuery: "",
    analysisTimeRange: formState.analysisTimeRange,
    channelIds: formState.channelIds,
    ...(formState.analysisMode === "intel_event" ||
    formState.analysisMode === "project" ||
    formState.analysisMode === "web_intel"
      ? { includeInTimeline: formState.includeInTimeline }
      : {}),
    ...(formState.analysisMode === "project"
      ? { projectWaveIntervalSeconds: formState.projectWaveIntervalSeconds }
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

/** Builds the schedule subresource payload for recurring tasks. */
export function formStateToTaskSchedule(formState: TaskFormState): TaskScheduleConfig {
  const isAllDay = formState.eventIsAllDay;
  return {
    rrule: formState.rrule.trim(),
    eventStartTime: isAllDay ? null : formState.eventStartTime.trim() || null,
    eventEndTime: isAllDay ? null : formState.eventEndTime.trim() || null,
    eventIsAllDay: isAllDay,
    eventLocation: formState.eventLocation.trim() || null,
    eventDescription: formState.eventDescription.trim() || null,
  };
}

/**
 * Payload for atomic ``POST /api/v1/tasks/recurring``.
 * Same writer as timeline ``createRecurringTimelineEvent`` — do not use
 * shell ``POST /tasks`` + ``PUT /schedule`` for task-page creates.
 */
export function formStateToCreateRecurringConfig(
  formState: TaskFormState,
): CreateRecurringTaskConfig {
  const schedule = formStateToTaskSchedule(formState);
  return {
    name: formState.name.trim(),
    description: formState.description.trim() || null,
    rrule: schedule.rrule,
    eventStartTime: schedule.eventStartTime,
    eventEndTime: schedule.eventEndTime,
    eventIsAllDay: schedule.eventIsAllDay,
    eventLocation: schedule.eventLocation,
    eventDescription: schedule.eventDescription,
    worksetId: formState.worksetId,
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
  const schedule = scheduleFieldsFromTask(task);
  return {
    name: task.name,
    description: task.description ?? "",
    promptTemplate: task.promptTemplate,
    webSearchQuery: task.webSearchQuery ?? "",
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
  const schedule = scheduleFieldsFromTask({
    scheduleRrule: config.scheduleRrule ?? null,
  });

  return {
    id: "test-id",
    name: config.name,
    description: config.description ?? null,
    promptTemplate: config.promptTemplate,
    webSearchQuery: config.webSearchQuery ?? "",
    analysisMode: config.analysisMode ?? "leaderboard",
    analysisTimeRange: config.analysisTimeRange ?? "1d",
    version: 1,
    isActive: true,
    scheduleRrule: schedule.scheduleRrule,
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
    webSearchQuery: "",
    scheduleRrule,
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
  /** Channels allowed but not required (web_intel timed vs message-gate). */
  channelsOptional: boolean;
  channelsRequired: boolean;
  /** Message analysisTimeRange chips (not used by web_intel Agent search). */
  analysisTimeRangeVisible: boolean;
  /** Timeline include toggle (event / project / web_intel). */
  timelineToggleVisible: boolean;
  /** Prompt is required to save (all AI modes with a prompt field). */
  promptRequired: boolean;
  isWebIntel: boolean;
  isProject: boolean;
  isRecurring: boolean;
}

/** Field visibility rules for ChatEditorForm by analysis mode. */
export function getTaskModeFieldVisibility(mode: AnalysisMode): TaskModeFieldVisibility {
  const hidesPromptAndChannel = analysisModeHidesPromptAndChannel(mode);
  const channelsRequired = analysisModeRequiresChannels(mode);
  const channelsOptional = analysisModeShowsOptionalChannels(mode);
  const isWebIntel = analysisModeIsWebIntel(mode);
  const promptFieldsVisible = !hidesPromptAndChannel;
  return {
    rruleFieldsVisible: analysisModeShowsRruleFields(mode),
    promptFieldsVisible,
    channelFieldsVisible:
      !hidesPromptAndChannel && (channelsRequired || channelsOptional),
    channelsOptional,
    channelsRequired,
    analysisTimeRangeVisible: promptFieldsVisible && !isWebIntel,
    timelineToggleVisible:
      mode === "intel_event" || mode === "project" || mode === "web_intel",
    promptRequired: promptFieldsVisible,
    isWebIntel,
    isProject: mode === "project",
    isRecurring: mode === "recurring",
  };
}

/** Whether web_intel message-gate overrides should show. */
export function taskShowsMessageBatchOverrides(
  mode: AnalysisMode,
  channelIds: readonly string[],
): boolean {
  return (
    mode === "intel_event" ||
    mode === "leaderboard" ||
    webIntelMessageGateActive(mode, channelIds)
  );
}
