import { describe, it, expect } from "vitest";
import type { TaskFormState } from "../../types";
import { DEFAULT_FORM_STATE } from "../../hooks/useTaskEditorState";
import {
  analysisTaskToFormState,
  applyConfigToFormState,
  buildCurrentTaskPayload,
  formStateToTaskConfig,
  roundTripFormState,
  scheduleFieldsFromTask,
} from "./taskFormUtils";
import type { AnalysisTask } from "../../types";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";

const sampleBase: TaskFormState = {
  name: "Base Task",
  description: "Base description",
  promptTemplate: "Analyze messages",
  scheduleType: "daily",
  scheduleValue: "09:00",
  scheduleRrule: null,
  analysisMode: "leaderboard",
  analysisTimeRange: "1d",
  channelIds: ["ch-1", "ch-2"],
  rrule: "",
  eventStartTime: "",
  eventEndTime: "",
  eventIsAllDay: false,
  eventLocation: "",
  eventDescription: "",
  includeInTimeline: true,
  agentWaveIntervalSeconds: null,
  batchOverlapCount: null,
  analysisTriggerThreshold: null,
  analysisBatchMessageLimit: null,
  analysisStrategyMode: null,
  worksetId: SYSTEM_WORKSET_ID,
  llmProfileId: "",
  notifyPref: "follow",
  triggerMode: "schedule",
  capCalendarRead: true,
  capCalendarWrites: false,
  capWebSearch: false,
  capForceWebSearch: false,
  capReadAnalysisEvents: true,
  capReadItems: true,
  outputCalendar: false,
  outputAnalysisEvents: false,
};

const fullConfig: Partial<TaskFormState> = {
  name: "Updated Task",
  description: "Updated description",
  promptTemplate: "New prompt",
  scheduleType: "weekly",
  scheduleValue: "1:10:30",
  scheduleRrule: null,
  analysisMode: "intel_event",
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
    analysisTimeRange: "1d",
    channelIds: ["abc12345"],
    rrule: "",
    eventStartTime: "",
    eventEndTime: "",
    eventIsAllDay: false,
    eventLocation: "",
    eventDescription: "",
  includeInTimeline: true,
  agentWaveIntervalSeconds: null,
  batchOverlapCount: null,
  analysisTriggerThreshold: null,
  analysisBatchMessageLimit: null,
  analysisStrategyMode: null,
  worksetId: SYSTEM_WORKSET_ID,
  llmProfileId: "",
  triggerMode: "schedule",
  capCalendarRead: true,
  capCalendarWrites: false,
  capWebSearch: false,
  capForceWebSearch: false,
  capReadAnalysisEvents: true,
  capReadItems: true,
  outputCalendar: false,
  outputAnalysisEvents: false,
  },
  {
    name: "Daily Task",
    description: "Daily run",
    promptTemplate: "Analyze daily",
    scheduleType: "daily",
    scheduleValue: "14:30",
    scheduleRrule: null,
    analysisMode: "intel_event",
    analysisTimeRange: "48h",
    channelIds: ["ch-1", "ch-2"],
    rrule: "",
    eventStartTime: "",
    eventEndTime: "",
    eventIsAllDay: false,
    eventLocation: "",
    eventDescription: "",
  includeInTimeline: true,
  agentWaveIntervalSeconds: null,
  batchOverlapCount: null,
  analysisTriggerThreshold: null,
  analysisBatchMessageLimit: null,
  analysisStrategyMode: null,
  worksetId: SYSTEM_WORKSET_ID,
  llmProfileId: "",
  triggerMode: "schedule",
  capCalendarRead: true,
  capCalendarWrites: false,
  capWebSearch: false,
  capForceWebSearch: false,
  capReadAnalysisEvents: true,
  capReadItems: true,
  outputCalendar: false,
  outputAnalysisEvents: false,
  },
  {
    name: "Weekly Task",
    description: "Weekly run",
    promptTemplate: "Analyze weekly",
    scheduleType: "weekly",
    scheduleValue: "3:09:00",
    scheduleRrule: null,
    analysisMode: "intel_event",
    analysisTimeRange: "7d",
    channelIds: ["weekly-ch"],
    rrule: "",
    eventStartTime: "",
    eventEndTime: "",
    eventIsAllDay: false,
    eventLocation: "",
    eventDescription: "",
  includeInTimeline: true,
  agentWaveIntervalSeconds: null,
  batchOverlapCount: null,
  analysisTriggerThreshold: null,
  analysisBatchMessageLimit: null,
  analysisStrategyMode: null,
  worksetId: SYSTEM_WORKSET_ID,
  llmProfileId: "",
  triggerMode: "schedule",
  capCalendarRead: true,
  capCalendarWrites: false,
  capWebSearch: false,
  capForceWebSearch: false,
  capReadAnalysisEvents: true,
  capReadItems: true,
  outputCalendar: false,
  outputAnalysisEvents: false,
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
  agentWaveIntervalSeconds: null,
  batchOverlapCount: null,
  analysisTriggerThreshold: null,
  analysisBatchMessageLimit: null,
  analysisStrategyMode: null,
  worksetId: SYSTEM_WORKSET_ID,
  llmProfileId: "",
  triggerMode: "schedule",
  capCalendarRead: true,
  capCalendarWrites: false,
  capWebSearch: false,
  capForceWebSearch: false,
  capReadAnalysisEvents: true,
  capReadItems: true,
  outputCalendar: false,
  outputAnalysisEvents: false,
  },
];

const sampleFormState: TaskFormState = {
  ...sampleBase,
  name: "BTC Tracker",
  description: "Track BTC mentions",
  promptTemplate: "Analyze crypto messages",
  scheduleType: "daily",
  scheduleValue: "08:00",
  scheduleRrule: null,
  analysisMode: "leaderboard",
  analysisTimeRange: "1d",
  channelIds: ["ch-abc123", "ch-def456"],
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
    const sparse = { name: "Only Name", analysisMode: "intel_event" as const };
    const result = applyConfigToFormState(sampleBase, sparse);

    expect(result.name).toBe("Only Name");
    expect(result.analysisMode).toBe("intel_event");
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
  it("omits empty llmProfileId and includes a set profile id", () => {
    expect(formStateToTaskConfig(sampleBase)).not.toHaveProperty("llmProfileId");
    const withProfile = formStateToTaskConfig({
      ...sampleBase,
      llmProfileId: " profile-abc ",
    });
    expect(withProfile.llmProfileId).toBe("profile-abc");
  });

  it("keeps optional channelIds for agent and emits message-gate overrides when bound", () => {
    const payload = formStateToTaskConfig({
      ...sampleBase,
      analysisMode: "agent",
      triggerMode: "message_threshold",
      outputCalendar: false,
      outputAnalysisEvents: true,
      capWebSearch: true,
      capForceWebSearch: true,
      capReadAnalysisEvents: true,
      capReadItems: true,
      promptTemplate: "Extract pricing notes",
      channelIds: ["ch-1", "ch-2"],
      scheduleType: "hourly",
      scheduleValue: null,
      batchOverlapCount: 2,
      analysisTriggerThreshold: 5,
      analysisBatchMessageLimit: 40,
      analysisStrategyMode: "balanced",
    });
    expect(payload.channelIds).toEqual(["ch-1", "ch-2"]);
    expect(payload.batchOverlapCount).toBe(2);
    expect(payload.analysisTriggerThreshold).toBe(5);
    expect(payload.analysisBatchMessageLimit).toBe(40);
    expect(payload.analysisStrategyMode).toBe("balanced");
  });

  it("omits message-gate overrides for agent when no channels are bound", () => {
    const payload = formStateToTaskConfig({
      ...sampleBase,
      analysisMode: "agent",
      triggerMode: "schedule",
      outputCalendar: false,
      outputAnalysisEvents: true,
      promptTemplate: "Extract pricing notes",
      channelIds: [],
      scheduleType: "hourly",
      scheduleValue: null,
      batchOverlapCount: 2,
      analysisTriggerThreshold: 5,
    });
    expect(payload.channelIds).toEqual([]);
    expect(payload).not.toHaveProperty("batchOverlapCount");
    expect(payload).not.toHaveProperty("analysisTriggerThreshold");
  });
  it.each(["leaderboard", "intel_event"] as const)(
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

  it("includes includeInTimeline for event mode payloads", () => {
    const payload = formStateToTaskConfig({
      ...sampleBase,
      analysisMode: "intel_event",
      includeInTimeline: false,
    });
    expect(payload.includeInTimeline).toBe(false);
  });

  it("includes outputAnalysisEvents for intel_event and leaderboard payloads", () => {
    expect(
      formStateToTaskConfig({
        ...sampleBase,
        analysisMode: "intel_event",
        outputAnalysisEvents: false,
      }).outputAnalysisEvents,
    ).toBe(false);
    expect(
      formStateToTaskConfig({
        ...sampleBase,
        analysisMode: "leaderboard",
        outputAnalysisEvents: true,
      }).outputAnalysisEvents,
    ).toBe(true);
  });

  it("sends canonical scheduleRrule derived from presets", () => {
    const payload = formStateToTaskConfig({
      ...sampleBase,
      scheduleType: "hourly",
      scheduleValue: null,
      scheduleRrule: null,
    });
    expect(payload.scheduleRrule).toBe("FREQ=HOURLY");
    expect(payload).not.toHaveProperty("scheduleType");
    expect(payload).not.toHaveProperty("scheduleValue");
  });

  it("preserves unmappable scheduleRrule on save", () => {
    const payload = formStateToTaskConfig({
      ...sampleBase,
      scheduleType: "seconds_10",
      scheduleValue: null,
      scheduleRrule: "FREQ=HOURLY;INTERVAL=2",
    });
    expect(payload.scheduleRrule).toBe("FREQ=HOURLY;INTERVAL=2");
    expect(payload).not.toHaveProperty("scheduleType");
    expect(payload).not.toHaveProperty("scheduleValue");
  });
});

describe("scheduleFieldsFromTask", () => {
  it("maps canonical RRULE into FE presets", () => {
    expect(
      scheduleFieldsFromTask({
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
      analysisMode: "intel_event",
      analysisTimeRange: "1d",
      version: 1,
      isActive: true,
      scheduleRrule: "FREQ=HOURLY",
      channelIds: [],
      llmProfileId: "profile-xyz",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    } as AnalysisTask;
    const form = analysisTaskToFormState(task);
    expect(form.scheduleType).toBe("hourly");
    expect(form.scheduleRrule).toBe("FREQ=HOURLY");
    expect(form.llmProfileId).toBe("profile-xyz");
    expect(form.outputAnalysisEvents).toBe(true);
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
    expect(payload.analysisMode).toBe(sampleFormState.analysisMode);
    expect(payload.analysisTimeRange).toBe(sampleFormState.analysisTimeRange);
    expect(payload.channelIds).toEqual(sampleFormState.channelIds);
    expect(payload.includeInTimeline).toBe(sampleFormState.includeInTimeline);
    expect(payload.outputAnalysisEvents).toBe(sampleFormState.outputAnalysisEvents);
    expect(Object.keys(payload).sort()).toEqual([
      "analysisMode",
      "analysisTimeRange",
      "channelIds",
      "description",
      "includeInTimeline",
      "name",
      "outputAnalysisEvents",
      "promptTemplate",
      "scheduleRrule",
    ].sort());
    expect(payload.scheduleRrule).toBe("FREQ=DAILY;BYHOUR=8;BYMINUTE=0");
    expect(payload).not.toHaveProperty("scheduleType");
    expect(payload).not.toHaveProperty("scheduleValue");
  });

  it("forwards includeInTimeline false for event-mode drafts", () => {
    const payload = buildCurrentTaskPayload({
      ...sampleFormState,
      analysisMode: "intel_event",
      includeInTimeline: false,
  agentWaveIntervalSeconds: null,
  batchOverlapCount: null,
  analysisTriggerThreshold: null,
  analysisBatchMessageLimit: null,
  analysisStrategyMode: null,
    });
    expect(payload.includeInTimeline).toBe(false);
  });

  it("derives scheduleRrule from weekly and custom_seconds presets", () => {
    const weekly: TaskFormState = {
      ...sampleFormState,
      scheduleType: "weekly",
      scheduleValue: "1:12:00",
      scheduleRrule: null,
      analysisMode: "intel_event",
      analysisTimeRange: "7d",
    };
    const custom: TaskFormState = {
      ...sampleFormState,
      scheduleType: "custom_seconds",
      scheduleValue: "600",
      scheduleRrule: null,
      channelIds: ["single-ch"],
    };

    expect(buildCurrentTaskPayload(weekly).scheduleRrule).toBe(
      "FREQ=WEEKLY;BYDAY=MO;BYHOUR=12;BYMINUTE=0",
    );
    expect(buildCurrentTaskPayload(custom).scheduleRrule).toBe("FREQ=SECONDLY;INTERVAL=600");
  });
});
