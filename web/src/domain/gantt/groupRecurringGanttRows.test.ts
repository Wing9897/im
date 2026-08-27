import { describe, expect, it } from "vitest";

import { makeEvent } from "../../test/timelineTestHelpers";
import { groupRecurringGanttRows } from "./groupRecurringGanttRows";

describe("groupRecurringGanttRows", () => {
  it("merges recurring occurrences with the same seriesId into one row with multiple bars", () => {
    const events = [
      makeEvent({
        id: "task-meet:2025-01-15T09:00:00Z",
        seriesId: "task-meet",
        title: "開會",
        source: "recurring",
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T10:00:00Z",
      }),
      makeEvent({
        id: "task-meet:2025-01-22T09:00:00Z",
        seriesId: "task-meet",
        title: "開會",
        source: "recurring",
        startTime: "2025-01-22T09:00:00Z",
        endTime: "2025-01-22T10:00:00Z",
      }),
      makeEvent({
        id: "task-meet:2025-01-29T09:00:00Z",
        seriesId: "task-meet",
        title: "開會",
        source: "recurring",
        startTime: "2025-01-29T09:00:00Z",
        endTime: "2025-01-29T10:00:00Z",
      }),
    ];

    const rows = groupRecurringGanttRows(events);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rowId).toBe("recurring:task-meet");
    expect(rows[0]!.label).toBe("開會");
    expect(rows[0]!.occurrences).toHaveLength(3);
    expect(rows[0]!.occurrences.map((item) => item.id)).toEqual([
      "task-meet:2025-01-15T09:00:00Z",
      "task-meet:2025-01-22T09:00:00Z",
      "task-meet:2025-01-29T09:00:00Z",
    ]);
    expect(rows[0]!.dismissed).toBe(false);
  });

  it("does not merge non-recurring events even when seriesId matches", () => {
    const events = [
      makeEvent({
        id: "analysis-1",
        taskId: "task-shared",
        title: "Analysis A",
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T10:00:00Z",
      }),
      makeEvent({
        id: "analysis-2",
        taskId: "task-shared",
        title: "Analysis B",
        startTime: "2025-01-15T11:00:00Z",
        endTime: "2025-01-15T12:00:00Z",
      }),
      makeEvent({
        id: "user-1",
        taskId: "task-shared",
        title: "User note",
        source: "user",
        startTime: "2025-01-15T13:00:00Z",
        endTime: "2025-01-15T14:00:00Z",
      }),
    ];

    const rows = groupRecurringGanttRows(events);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.rowId)).toEqual(["analysis-1", "analysis-2", "user-1"]);
    expect(rows.every((row) => row.occurrences.length === 1)).toBe(true);
  });

  it("keeps recurring events without seriesId as singleton rows", () => {
    const event = makeEvent({
      id: "orphan-occ",
      seriesId: null,
      title: "Orphan",
      source: "recurring",
      startTime: "2025-01-15T09:00:00Z",
      endTime: "2025-01-15T10:00:00Z",
    });
    const rows = groupRecurringGanttRows([event]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rowId).toBe("orphan-occ");
    expect(rows[0]!.occurrences).toHaveLength(1);
  });

  it("marks a series row dismissed only when every occurrence is dismissed", () => {
    const mixed = groupRecurringGanttRows([
      makeEvent({
        id: "a:1",
        seriesId: "a",
        title: "A",
        source: "recurring",
        dismissed: true,
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T10:00:00Z",
      }),
      makeEvent({
        id: "a:2",
        seriesId: "a",
        title: "A",
        source: "recurring",
        dismissed: false,
        startTime: "2025-01-16T09:00:00Z",
        endTime: "2025-01-16T10:00:00Z",
      }),
    ]);
    expect(mixed[0]!.dismissed).toBe(false);

    const allDismissed = groupRecurringGanttRows([
      makeEvent({
        id: "b:1",
        seriesId: "b",
        title: "B",
        source: "recurring",
        dismissed: true,
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T10:00:00Z",
      }),
      makeEvent({
        id: "b:2",
        seriesId: "b",
        title: "B",
        source: "recurring",
        dismissed: true,
        startTime: "2025-01-16T09:00:00Z",
        endTime: "2025-01-16T10:00:00Z",
      }),
    ]);
    expect(allDismissed[0]!.dismissed).toBe(true);
  });

  it("sorts active rows before fully dismissed rows", () => {
    const rows = groupRecurringGanttRows([
      makeEvent({
        id: "dismissed-early",
        title: "Dismissed",
        dismissed: true,
        startTime: "2025-01-15T08:00:00Z",
        endTime: "2025-01-15T09:00:00Z",
      }),
      makeEvent({
        id: "active-late",
        title: "Active",
        dismissed: false,
        startTime: "2025-01-15T12:00:00Z",
        endTime: "2025-01-15T13:00:00Z",
      }),
    ]);
    expect(rows.map((row) => row.rowId)).toEqual(["active-late", "dismissed-early"]);
  });

  it("keeps separate series for different seriesIds and sorts occurrences by startTime", () => {
    const rows = groupRecurringGanttRows([
      makeEvent({
        id: "b:later",
        seriesId: "task-b",
        title: "B",
        source: "recurring",
        startTime: "2025-01-20T09:00:00Z",
        endTime: "2025-01-20T10:00:00Z",
      }),
      makeEvent({
        id: "a:later",
        seriesId: "task-a",
        title: "A",
        source: "recurring",
        startTime: "2025-01-18T09:00:00Z",
        endTime: "2025-01-18T10:00:00Z",
      }),
      makeEvent({
        id: "a:earlier",
        seriesId: "task-a",
        title: "A",
        source: "recurring",
        startTime: "2025-01-11T09:00:00Z",
        endTime: "2025-01-11T10:00:00Z",
      }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]!.rowId).toBe("recurring:task-a");
    expect(rows[0]!.occurrences.map((item) => item.id)).toEqual(["a:earlier", "a:later"]);
    expect(rows[1]!.rowId).toBe("recurring:task-b");
  });

  it("merges subscribed occurrences with the same seriesId into one row", () => {
    const rows = groupRecurringGanttRows([
      makeEvent({
        id: "Alice/Work:weekly:2025-01-15T09:00:00Z",
        seriesId: "series-weekly",
        title: "Standup",
        source: "subscribed:Alice/Work",
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T10:00:00Z",
      }),
      makeEvent({
        id: "Alice/Work:weekly:2025-01-22T09:00:00Z",
        seriesId: "series-weekly",
        title: "Standup",
        source: "subscribed:Alice/Work",
        startTime: "2025-01-22T09:00:00Z",
        endTime: "2025-01-22T10:00:00Z",
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rowId).toBe("recurring:subscribed:Alice/Work:series-weekly");
    expect(rows[0]!.occurrences).toHaveLength(2);
    expect(rows[0]!.label).toBe("Standup");
  });

  it("keeps subscribed one-offs as singleton rows when seriesId is missing", () => {
    const rows = groupRecurringGanttRows([
      makeEvent({
        id: "Alice/Work:one-a",
        seriesId: null,
        title: "Busy A",
        source: "subscribed:Alice/Work",
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T10:00:00Z",
      }),
      makeEvent({
        id: "Alice/Work:one-b",
        seriesId: null,
        title: "Busy B",
        source: "subscribed:Alice/Work",
        startTime: "2025-01-15T11:00:00Z",
        endTime: "2025-01-15T12:00:00Z",
      }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.rowId)).toEqual(["Alice/Work:one-a", "Alice/Work:one-b"]);
  });

  it("does not mix a local series with a subscribed series that reuse the same seriesId string", () => {
    const rows = groupRecurringGanttRows([
      makeEvent({
        id: "local:1",
        seriesId: "series-weekly",
        title: "Local",
        source: "recurring",
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T10:00:00Z",
      }),
      makeEvent({
        id: "Alice/Work:weekly:2025-01-15T09:00:00Z",
        seriesId: "series-weekly",
        title: "Remote",
        source: "subscribed:Alice/Work",
        startTime: "2025-01-15T11:00:00Z",
        endTime: "2025-01-15T12:00:00Z",
      }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.rowId)).toEqual([
      "recurring:series-weekly",
      "recurring:subscribed:Alice/Work:series-weekly",
    ]);
  });
});

