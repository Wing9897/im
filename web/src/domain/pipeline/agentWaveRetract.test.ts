import { describe, expect, it } from "vitest";
import type { UserEvent } from "../../api/userEvents";
import type { AgentTickLogEntry } from "../../types/analysis";
import type { RecurringSeries } from "../../types/recurring";
import {
  lastCompletedBatchWindow,
  selectAgentWaveRecurringSeries,
  selectAgentWaveUserEvents,
} from "./agentWaveRetract";

function tick(overrides: Partial<AgentTickLogEntry>): AgentTickLogEntry {
  return {
    batchId: "b1",
    status: "completed",
    outcome: "success",
    messageCount: 1,
    createdAt: "2026-08-20T08:00:00.000Z",
    completedAt: "2026-08-20T08:05:00.000Z",
    ...overrides,
  };
}

function userEvent(overrides: Partial<UserEvent>): UserEvent {
  return {
    id: "e1",
    title: "Shift",
    body: "",
    startTime: "2026-08-21T00:00:00.000Z",
    endTime: null,
    location: null,
    origin: "agent",
    isAllDay: false,
    taskId: "task-1",
    worksetId: "__general__",
    kind: "normal",
    notifyPref: "inherit",
    source: "user",
    dismissed: false,
    important: false,
    createdAt: "2026-08-20T08:02:00.000Z",
    updatedAt: "2026-08-20T08:02:00.000Z",
    ...overrides,
  };
}

function series(overrides: Partial<RecurringSeries>): RecurringSeries {
  return {
    id: "rs-1",
    name: "Standup",
    rrule: "FREQ=DAILY",
    eventIsAllDay: false,
    isActive: true,
    worksetId: "__general__",
    parentTaskId: "task-1",
    notifyPref: "inherit",
    createdAt: "2026-08-20T08:03:00.000Z",
    ...overrides,
  };
}

describe("lastCompletedBatchWindow", () => {
  it("uses the newest completed tick", () => {
    const window = lastCompletedBatchWindow([
      tick({
        batchId: "newer",
        status: "failed",
        createdAt: "2026-08-20T09:00:00.000Z",
        completedAt: "2026-08-20T09:01:00.000Z",
      }),
      tick({
        batchId: "done",
        createdAt: "2026-08-20T08:00:00.000Z",
        completedAt: "2026-08-20T08:05:00.000Z",
      }),
    ]);
    expect(window).toEqual({
      batchId: "done",
      startMs: Date.parse("2026-08-20T08:00:00.000Z"),
      endMs: Date.parse("2026-08-20T08:05:00.000Z"),
    });
  });

  it("returns null when no completed tick exists", () => {
    expect(
      lastCompletedBatchWindow([
        tick({ status: "pending", outcome: "", completedAt: null }),
      ]),
    ).toBeNull();
    expect(lastCompletedBatchWindow([])).toBeNull();
  });
});

describe("selectAgentWaveUserEvents", () => {
  const window = lastCompletedBatchWindow([tick({})])!;

  it("keeps agent events for this task inside the batch window", () => {
    const matched = selectAgentWaveUserEvents(
      [
        userEvent({ id: "in" }),
        userEvent({ id: "manual", origin: "manual" }),
        userEvent({ id: "other-task", taskId: "task-2" }),
        userEvent({
          id: "outside",
          createdAt: "2026-08-20T07:59:00.000Z",
        }),
        userEvent({ id: "hidden", dismissed: true }),
      ],
      "task-1",
      window,
    );
    expect(matched.map((row) => row.id)).toEqual(["in"]);
  });
});

describe("selectAgentWaveRecurringSeries", () => {
  const window = lastCompletedBatchWindow([tick({})])!;

  it("keeps child series created in the same window", () => {
    const matched = selectAgentWaveRecurringSeries(
      [
        series({ id: "in" }),
        series({ id: "other", parentTaskId: "task-2" }),
        series({ id: "old", createdAt: "2026-08-19T00:00:00.000Z" }),
      ],
      "task-1",
      window,
    );
    expect(matched.map((row) => row.id)).toEqual(["in"]);
  });
});
