import { describe, it, expect } from "vitest";
import type { TaskFormState } from "../../types";
import { DEFAULT_FORM_STATE } from "../../hooks/useTaskForm";
import {
  applyConfigToFormState,
  buildCurrentTaskPayload,
  formStateToTaskConfig,
  roundTripFormState,
} from "./taskFormUtils";

const sampleBase: TaskFormState = {
  name: "Base Task",
  description: "Base description",
  promptTemplate: "Analyze messages",
  scheduleType: "daily",
  scheduleValue: "09:00",
  analysisMode: "leaderboard",
  analysisTimeRange: "24h",
  channelIds: ["ch-1", "ch-2"],
  rrule: "",
  eventStartTime: "",
  eventEndTime: "",
  eventIsAllDay: false,
  eventLocation: "",
  eventDescription: "",
  includeInTimeline: true,
  projectWaveIntervalSeconds: null,
  batchOverlapCount: null,
  analysisTriggerThreshold: null,
  analysisBatchMessageLimit: null,
  analysisStrategyMode: null,
};

const fullConfig: Partial<TaskFormState> = {
  name: "Updated Task",
  description: "Updated description",
  promptTemplate: "New prompt",
  scheduleType: "weekly",
  scheduleValue: "1:10:30",
  analysisMode: "event",
  analysisTimeRange: "48h",
  channelIds: ["ch-3"],
};

function normalizeFormState(state: TaskFormState): TaskFormState {
  return { ...state, description: state.description || "" };
}

const validFormStates: TaskFormState[] = [
  {
    name: "Hourly Task",
    description: "",
    promptTemplate: "Analyze hourly",
    scheduleType: "hourly",
    scheduleValue: null,
    analysisMode: "leaderboard",
    analysisTimeRange: "24h",
    channelIds: ["abc12345"],
    rrule: "",
    eventStartTime: "",
    eventEndTime: "",
    eventIsAllDay: false,
    eventLocation: "",
    eventDescription: "",
  includeInTimeline: true,
  projectWaveIntervalSeconds: null,
  batchOverlapCount: null,
  analysisTriggerThreshold: null,
  analysisBatchMessageLimit: null,
  analysisStrategyMode: null,
  },
  {
    name: "Daily Task",
    description: "Daily run",
    promptTemplate: "Analyze daily",
    scheduleType: "daily",
    scheduleValue: "14:30",
    analysisMode: "event",
    analysisTimeRange: "48h",
    channelIds: ["ch-1", "ch-2"],
    rrule: "",
    eventStartTime: "",
    eventEndTime: "",
    eventIsAllDay: false,
    eventLocation: "",
    eventDescription: "",
  includeInTimeline: true,
  projectWaveIntervalSeconds: null,
  batchOverlapCount: null,
  analysisTriggerThreshold: null,
  analysisBatchMessageLimit: null,
  analysisStrategyMode: null,
  },
  {
    name: "Weekly Task",
    description: "Weekly run",
    promptTemplate: "Analyze weekly",
    scheduleType: "weekly",
    scheduleValue: "3:09:00",
    analysisMode: "event",
    analysisTimeRange: "7d",
    channelIds: ["weekly-ch"],
    rrule: "",
    eventStartTime: "",
    eventEndTime: "",
    eventIsAllDay: false,
    eventLocation: "",
    eventDescription: "",
  includeInTimeline: true,
  projectWaveIntervalSeconds: null,
  batchOverlapCount: null,
  analysisTriggerThreshold: null,
  analysisBatchMessageLimit: null,
  analysisStrategyMode: null,
  },
  {
    name: "Custom Seconds",
    description: "",
    promptTemplate: "Fast poll",
    scheduleType: "custom_seconds",
    scheduleValue: "300",
    analysisMode: "leaderboard",
    analysisTimeRange: "1h",
    channelIds: ["fast-ch"],
    rrule: "",
    eventStartTime: "",
    eventEndTime: "",
    eventIsAllDay: false,
    eventLocation: "",
    eventDescription: "",
  includeInTimeline: true,
  projectWaveIntervalSeconds: null,
  batchOverlapCount: null,
  analysisTriggerThreshold: null,
  analysisBatchMessageLimit: null,
  analysisStrategyMode: null,
  },
];

const sampleFormState: TaskFormState = {
  name: "BTC Tracker",
  description: "Track BTC mentions",
  promptTemplate: "Analyze crypto messages",
  scheduleType: "daily",
  scheduleValue: "08:00",
  analysisMode: "leaderboard",
  analysisTimeRange: "24h",
  channelIds: ["ch-abc123", "ch-def456"],
  rrule: "",
  eventStartTime: "",
  eventEndTime: "",
  eventIsAllDay: false,
  eventLocation: "",
  eventDescription: "",
  includeInTimeline: true,
  projectWaveIntervalSeconds: null,
  batchOverlapCount: null,
  analysisTriggerThreshold: null,
  analysisBatchMessageLimit: null,
  analysisStrategyMode: null,
};

describe("applyConfigToFormState", () => {
  it("applying a full config to default state reflects every field", () => {
    const result = applyConfigToFormState(DEFAULT_FORM_STATE, fullConfig);
    expect(result.name).toBe(fullConfig.name);
    expect(result.description).toBe(fullConfig.description);
    expect(result.promptTemplate).toBe(fullConfig.promptTemplate);
    expect(result.scheduleType).toBe(fullConfig.scheduleType);
    expect(result.scheduleValue).toBe(fullConfig.scheduleValue);
    expect(result.analysisMode).toBe(fullConfig.analysisMode);
    expect(result.analysisTimeRange).toBe(fullConfig.analysisTimeRange);
    expect(result.channelIds).toEqual(fullConfig.channelIds);
  });

  it("applies includeInTimeline when provided", () => {
    const result = applyConfigToFormState(sampleBase, { includeInTimeline: false });
    expect(result.includeInTimeline).toBe(false);
    expect(applyConfigToFormState(sampleBase, {}).includeInTimeline).toBe(true);
  });

  it("applying a sparse config reflects only provided fields", () => {
    const sparse = { name: "Only Name", analysisMode: "event" as const };
    const result = applyConfigToFormState(sampleBase, sparse);

    expect(result.name).toBe("Only Name");
    expect(result.analysisMode).toBe("event");
    expect(result.description).toBe(sampleBase.description);
    expect(result.promptTemplate).toBe(sampleBase.promptTemplate);
    expect(result.scheduleType).toBe(sampleBase.scheduleType);
    expect(result.channelIds).toEqual(sampleBase.channelIds);
  });

  it("applying an empty config preserves the base state entirely", () => {
    expect(applyConfigToFormState(sampleBase, {})).toEqual(sampleBase);
  });

  it("applying a config does not mutate the original base state", () => {
    const baseCopy = { ...sampleBase, channelIds: [...sampleBase.channelIds] };
    applyConfigToFormState(sampleBase, fullConfig);
    expect(sampleBase).toEqual(baseCopy);
  });
});

describe("formStateToTaskConfig calendar contract", () => {
  it.each(["leaderboard", "event"] as const)(
    "omits stale calendar fields after switching to %s mode",
    (analysisMode) => {
      const payload = formStateToTaskConfig({
        ...sampleBase,
        analysisMode,
        rrule: "FREQ=WEEKLY;BYDAY=MO",
        eventStartTime: "2025-06-01T09:00:00Z",
        eventEndTime: "2025-06-01T10:00:00Z",
        eventIsAllDay: true,
        eventLocation: "Stale room",
        eventDescription: "Stale calendar description",
      });

      expect(payload).toMatchObject({
        analysisMode,
        promptTemplate: sampleBase.promptTemplate,
        analysisTimeRange: sampleBase.analysisTimeRange,
        channelIds: sampleBase.channelIds,
      });
      for (const calendarOnlyKey of [
        "rrule",
        "eventStartTime",
        "eventEndTime",
        "eventIsAllDay",
        "eventLocation",
        "eventDescription",
      ]) {
        expect(payload).not.toHaveProperty(calendarOnlyKey);
      }
    },
  );

  it("round-trips calendar recurrence and event fields with the existing camelCase payload shape", () => {
    const calendarState: TaskFormState = {
      ...sampleBase,
      analysisMode: "recurring",
      promptTemplate: "stale analysis prompt",
      channelIds: ["stale-channel"],
      rrule: "  FREQ=WEEKLY;BYDAY=MO,WE  ",
      eventStartTime: "2025-06-01T09:00:00Z",
      eventEndTime: "2025-06-01T10:30:00Z",
      eventIsAllDay: false,
      eventLocation: "  Conference Room A  ",
      eventDescription: "  Weekly planning  ",
    };

    const payload = formStateToTaskConfig(calendarState);

    expect(payload).toEqual({
      name: sampleBase.name,
      description: sampleBase.description,
      analysisMode: "recurring",
      scheduleType: sampleBase.scheduleType,
      scheduleValue: sampleBase.scheduleValue,
      promptTemplate: "",
      channelIds: [],
      rrule: "FREQ=WEEKLY;BYDAY=MO,WE",
      eventStartTime: "2025-06-01T09:00:00Z",
      eventEndTime: "2025-06-01T10:30:00Z",
      eventIsAllDay: false,
      eventLocation: "Conference Room A",
      eventDescription: "Weekly planning",
      includeInTimeline: true,
    });
    expect(roundTripFormState(calendarState)).toEqual({
      ...calendarState,
      promptTemplate: "",
      channelIds: [],
      rrule: "FREQ=WEEKLY;BYDAY=MO,WE",
      eventLocation: "Conference Room A",
      eventDescription: "Weekly planning",
      includeInTimeline: true,
      worksetId: null,
    });
  });

  it("includes includeInTimeline for event mode payloads", () => {
    const payload = formStateToTaskConfig({
      ...sampleBase,
      analysisMode: "event",
      includeInTimeline: false,
    });
    expect(payload.includeInTimeline).toBe(false);
  });
});

describe("roundTripFormState", () => {
  it("round-trip preserves all fields for valid TaskFormState values", () => {
    for (const formState of validFormStates) {
      const result = roundTripFormState(formState);
      const normalized = normalizeFormState(formState);
      expect(result.name).toBe(normalized.name);
      expect(result.description).toBe(normalized.description);
      expect(result.promptTemplate).toBe(normalized.promptTemplate);
      expect(result.scheduleType).toBe(normalized.scheduleType);
      expect(result.scheduleValue).toBe(normalized.scheduleValue);
      expect(result.analysisMode).toBe(normalized.analysisMode);
      expect(result.analysisTimeRange).toBe(normalized.analysisTimeRange);
      expect(result.channelIds).toEqual(normalized.channelIds);
    }
  });

  it("round-trip is idempotent", () => {
    for (const formState of validFormStates) {
      const firstTrip = roundTripFormState(formState);
      expect(roundTripFormState(firstTrip)).toEqual(firstTrip);
    }
  });
});

describe("buildCurrentTaskPayload", () => {
  it("constructed currentTask payload contains all field values from TaskFormState", () => {
    const payload = buildCurrentTaskPayload(sampleFormState);

    expect(payload.name).toBe(sampleFormState.name);
    expect(payload.description).toBe(sampleFormState.description);
    expect(payload.promptTemplate).toBe(sampleFormState.promptTemplate);
    expect(payload.scheduleType).toBe(sampleFormState.scheduleType);
    expect(payload.scheduleValue).toBe(sampleFormState.scheduleValue);
    expect(payload.analysisMode).toBe(sampleFormState.analysisMode);
    expect(payload.analysisTimeRange).toBe(sampleFormState.analysisTimeRange);
    expect(payload.channelIds).toEqual(sampleFormState.channelIds);
    expect(payload.includeInTimeline).toBe(sampleFormState.includeInTimeline);
    expect(Object.keys(payload).sort()).toEqual([
      "analysisMode",
      "analysisTimeRange",
      "channelIds",
      "description",
      "includeInTimeline",
      "name",
      "promptTemplate",
      "scheduleType",
      "scheduleValue",
    ].sort());
  });

  it("forwards includeInTimeline false for event-mode drafts", () => {
    const payload = buildCurrentTaskPayload({
      ...sampleFormState,
      analysisMode: "event",
      includeInTimeline: false,
  projectWaveIntervalSeconds: null,
  batchOverlapCount: null,
  analysisTriggerThreshold: null,
  analysisBatchMessageLimit: null,
  analysisStrategyMode: null,
    });
    expect(payload.includeInTimeline).toBe(false);
  });

  it("includes schedule-specific values for weekly and custom_seconds types", () => {
    const weekly: TaskFormState = {
      ...sampleFormState,
      scheduleType: "weekly",
      scheduleValue: "1:12:00",
      analysisMode: "event",
      analysisTimeRange: "7d",
    };
    const custom: TaskFormState = {
      ...sampleFormState,
      scheduleType: "custom_seconds",
      scheduleValue: "600",
      channelIds: ["single-ch"],
    };

    expect(buildCurrentTaskPayload(weekly).scheduleValue).toBe("1:12:00");
    expect(buildCurrentTaskPayload(custom).scheduleValue).toBe("600");
  });
});
