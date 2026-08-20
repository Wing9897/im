import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarWindowItem } from "../../../api/calendarWindow";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import {
  buildFilteredReminderEvents,
  fetchReminderSourceRows,
  mergeCatalogTaskNames,
  splitCalendarRows,
} from "./scannerFetch";

const mockFetchCalendarWindow = vi.hoisted(() => vi.fn());

vi.mock("../../../api/calendarWindow", () => ({
  fetchCalendarWindow: (...args: unknown[]) => mockFetchCalendarWindow(...args),
}));

vi.mock("../../../api/recurringSeries", () => ({
  listRecurringSeries: vi.fn(async () => ({ items: [], totalCount: 0, hasMore: false })),
}));

function windowRow(
  overrides: Partial<CalendarWindowItem> & Pick<CalendarWindowItem, "id" | "source" | "title">,
): CalendarWindowItem {
  return {
    startTime: "2026-07-20T10:00:00.000Z",
    endTime: null,
    location: null,
    isAllDay: false,
    timezone: null,
    emoji: null,
    taskId: null,
    seriesId: null,
    worksetId: SYSTEM_WORKSET_ID,
    itemId: null,
    origin: null,
    itemDateKind: null,
    notifyPref: "inherit",
    dismissed: false,
    important: false,
    taskName: null,
    isLastOccurrence: false,
    remindBeforeDays: null,
    body: "",
    ...overrides,
  };
}

const enabledWorksets = [
  {
    id: SYSTEM_WORKSET_ID,
    notifyEnabled: true,
  },
];

describe("notify scannerFetch", () => {
  beforeEach(() => {
    mockFetchCalendarWindow.mockReset();
  });

  it("fetches the official calendar window with all four sources", async () => {
    mockFetchCalendarWindow.mockResolvedValue([]);
    await fetchReminderSourceRows(
      "2026-07-20T08:59:00.000Z",
      "2026-07-20T10:05:00.000Z",
    );
    expect(mockFetchCalendarWindow).toHaveBeenCalledWith({
      start: "2026-07-20T08:59:00.000Z",
      end: "2026-07-20T10:05:00.000Z",
      includeAnalysis: true,
      includeUser: true,
      includeRecurring: true,
      includeItems: true,
    });
  });

  it("maps item_remind to user kind and recurring to recurring kind", () => {
    const split = splitCalendarRows([
      {
        id: "occ-1",
        seriesId: "series-1",
        title: "週會",
        startTime: "2026-07-20T10:00:00.000Z",
        source: "recurring",
      },
      {
        id: "item:i1:remind",
        title: "Passport",
        startTime: "2026-07-20T10:00:00.000Z",
        source: "item_remind",
      },
    ]);
    expect(split.recurring).toEqual([
      expect.objectContaining({ id: "occ-1", kind: "recurring", taskId: "series-1" }),
    ]);
    expect(split.items).toEqual([
      expect.objectContaining({ id: "item:i1:remind", kind: "user" }),
    ]);
  });

  it("keeps analysis, user, recurring, and item_remind rows that pass notify prefs", () => {
    const events = buildFilteredReminderEvents({
      windowItems: [
        windowRow({
          id: "a1",
          source: "analysis",
          title: "Analysis",
          taskId: "task-1",
          taskName: "Tracked",
        }),
        windowRow({ id: "u1", source: "user", title: "Manual" }),
        windowRow({
          id: "r1",
          source: "recurring",
          title: "Standup",
          seriesId: "series-1",
          taskName: "週會",
        }),
        windowRow({
          id: "i1",
          source: "item_remind",
          title: "Passport",
          itemDateKind: "remind",
        }),
      ],
      taskNameById: new Map(),
      globalEnabled: true,
      quietHoursActive: false,
      worksets: enabledWorksets,
      catalogTasks: [],
      seriesById: new Map(),
    });
    expect(events.map((row) => row.id)).toEqual(["a1", "u1", "r1", "i1"]);
    expect(events.map((row) => row.kind)).toEqual(["event", "user", "recurring", "user"]);
  });

  it("still includes dismissed and important window rows (timeline hide is display-only)", () => {
    const events = buildFilteredReminderEvents({
      windowItems: [
        windowRow({
          id: "dismissed-user",
          source: "user",
          title: "Hidden on timeline",
          dismissed: true,
          important: true,
        }),
      ],
      taskNameById: new Map(),
      globalEnabled: true,
      quietHoursActive: false,
      worksets: enabledWorksets,
      catalogTasks: [],
      seriesById: new Map(),
    });
    expect(events.map((row) => row.id)).toEqual(["dismissed-user"]);
  });

  it("drops item_remind rows whose notifyPref is off", () => {
    const events = buildFilteredReminderEvents({
      windowItems: [
        windowRow({
          id: "muted-item",
          source: "item_remind",
          title: "Muted passport",
          notifyPref: "off",
        }),
      ],
      taskNameById: new Map(),
      globalEnabled: true,
      quietHoursActive: false,
      worksets: enabledWorksets,
      catalogTasks: [],
      seriesById: new Map(),
    });
    expect(events).toEqual([]);
  });

  it("copies analysis taskId and recurring seriesId names into the catalog map", () => {
    const merged = mergeCatalogTaskNames(new Map([["existing", "Kept"]]), [
      windowRow({
        id: "a1",
        source: "analysis",
        title: "A",
        taskId: "task-1",
        taskName: "Tracked",
      }),
      windowRow({
        id: "r1",
        source: "recurring",
        title: "R",
        seriesId: "series-1",
        taskName: "週會",
      }),
    ]);
    expect(merged.get("existing")).toBe("Kept");
    expect(merged.get("task-1")).toBe("Tracked");
    expect(merged.get("series-1")).toBe("週會");
  });
});
