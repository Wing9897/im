import { describe, it, expect } from "vitest";
import type { TaskFormState } from "../../types";
import { DEFAULT_FORM_STATE } from "../../hooks/useTaskEditorState";
import {
  analysisTaskToFormState,
  applyConfigToFormState,
  buildCurrentTaskPayload,
  formStateToCreateRecurringConfig,
  formStateToTaskConfig,
  formStateToTaskSchedule,
  roundTripFormState,
  scheduleFieldsFromTask,
} from "./taskFormUtils";
import type { AnalysisTask } from "../../types";

const sampleBase: TaskFormState = {
  name: "Base Task",
  description: "Base description",
  promptTemplate: "Analyze messages",
  scheduleType: "daily",
  scheduleValue: "09:00",
  scheduleRrule: null,
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
  worksetId: null,
};

const fullConfig: Partial<TaskFormState> = {
  name: "Updated Task",
  description: "Updated description",
  promptTemplate: "New prompt",
  scheduleType: "weekly",
  scheduleValue: "1:10:30",
  scheduleRrule: null,
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
    scheduleRrule: null,
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
  worksetId: null,
  },
  {
    name: "Daily Task",
    description: "Daily run",
    promptTemplate: "Analyze daily",
    scheduleType: "daily",
    scheduleValue: "14:30",
    scheduleRrule: null,
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
  worksetId: null,
  },
  {
    name: "Weekly Task",
    description: "Weekly run",
    promptTemplate: "Analyze weekly",
    scheduleType: "weekly",
    scheduleValue: "3:09:00",
    scheduleRrule: null,
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
  worksetId: null,
  },
  {
    name: "Custom Seconds",
    description: "",
    promptTemplate: "Fast poll",
    scheduleType: "custom_seconds",
    scheduleValue: "300",
    scheduleRrule: null,
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
  worksetId: null,
  },
];

const sampleFormState: TaskFormState = {
  name: "BTC Tracker",
  description: "Track BTC mentions",
  promptTemplate: "Analyze crypto messages",
  scheduleType: "daily",
  scheduleValue: "08:00",
  scheduleRrule: null,
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

  it("keeps recurring task body free of schedule fields; schedule is a subresource", () => {
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
      scheduleRrule: "FREQ=DAILY;BYHOUR=9;BYMINUTE=0",
      promptTemplate: "",
      channelIds: [],
      includeInTimeline: true,
      worksetId: null,
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
  });

  it("formStateToCreateRecurringConfig maps editor fields for atomic create", () => {
    const calendarState: TaskFormState = {
      ...sampleBase,
      analysisMode: "recurring",
      rrule: "  FREQ=DAILY  ",
      eventStartTime: "22:00",
      eventEndTime: "06:00",
      eventIsAllDay: false,
      eventLocation: "  Night desk  ",
      eventDescription: "  Overnight  ",
      worksetId: "ws-ops",
    };

    expect(formStateToCreateRecurringConfig(calendarState)).toEqual({
      name: "Base Task",
      description: "Base description",
      rrule: "FREQ=DAILY",
      eventStartTime: "22:00",
      eventEndTime: "06:00",
      eventIsAllDay: false,
      eventLocation: "Night desk",
      eventDescription: "Overnight",
      worksetId: "ws-ops",
    });
  });

  it("formStateToTaskSchedule clears clocks when all-day", () => {
    expect(
      formStateToTaskSchedule({
        ...sampleBase,
        analysisMode: "recurring",
        rrule: "FREQ=DAILY",
        eventIsAllDay: true,
        eventStartTime: "09:00",
        eventEndTime: "10:00",
      }),
    ).toMatchObject({
      eventIsAllDay: true,
      eventStartTime: null,
      eventEndTime: null,
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

  it("sends canonical scheduleRrule derived from presets", () => {
    const payload = formStateToTaskConfig({
      ...sampleBase,
      scheduleType: "hourly",
      scheduleValue: null,
      scheduleRrule: null,
    });
    expect(payload.scheduleRrule).toBe("FREQ=HOURLY");
  });

  it("preserves unmappable scheduleRrule on save", () => {
    const payload = formStateToTaskConfig({
      ...sampleBase,
      scheduleType: "seconds_10",
      scheduleValue: null,
      scheduleRrule: "FREQ=HOURLY;INTERVAL=2",
    });
    expect(payload.scheduleRrule).toBe("FREQ=HOURLY;INTERVAL=2");
  });
});

describe("scheduleFieldsFromTask", () => {
  it("maps canonical RRULE into FE presets", () => {
    expect(
      scheduleFieldsFromTask({
        scheduleType: null,
        scheduleValue: null,
        scheduleRrule: "FREQ=DAILY;BYHOUR=9;BYMINUTE=30",
      }),
    ).toEqual({
      scheduleType: "daily",
      scheduleValue: "09:30",
      scheduleRrule: "FREQ=DAILY;BYHOUR=9;BYMINUTE=30",
    });
  });

  it("preserves unmappable RRULE instead of defaulting overwrite", () => {
    expect(
      scheduleFieldsFromTask({
        scheduleType: null,
        scheduleValue: null,
        scheduleRrule: "FREQ=HOURLY;INTERVAL=2",
      }),
    ).toEqual({
      scheduleType: "seconds_10",
      scheduleValue: null,
      scheduleRrule: "FREQ=HOURLY;INTERVAL=2",
    });
  });

  it("analysisTaskToFormState hydrates from scheduleRrule", () => {
    const task = {
      id: "t1",
      name: "Hydrate",
      description: null,
      promptTemplate: "p",
      analysisMode: "event",
      analysisTimeRange: "24h",
      version: 1,
      isActive: true,
      scheduleType: null,
      scheduleValue: null,
      scheduleRrule: "FREQ=HOURLY",
      channelIds: [],
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    } as AnalysisTask;
    const form = analysisTaskToFormState(task);
    expect(form.scheduleType).toBe("hourly");
    expect(form.scheduleRrule).toBe("FREQ=HOURLY");
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
      "scheduleRrule",
      "scheduleType",
      "scheduleValue",
    ].sort());
    expect(payload.scheduleRrule).toBe("FREQ=DAILY;BYHOUR=8;BYMINUTE=0");
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
      scheduleRrule: null,
      analysisMode: "event",
      analysisTimeRange: "7d",
    };
    const custom: TaskFormState = {
      ...sampleFormState,
      scheduleType: "custom_seconds",
      scheduleValue: "600",
      scheduleRrule: null,
      channelIds: ["single-ch"],
    };

    expect(buildCurrentTaskPayload(weekly).scheduleValue).toBe("1:12:00");
    expect(buildCurrentTaskPayload(custom).scheduleValue).toBe("600");
  });
});
