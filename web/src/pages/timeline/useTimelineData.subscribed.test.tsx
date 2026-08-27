/**
 * Subscribed calendars merge into timeline as read-only `subscribed:{handle}/{slug}`.
 */
import { type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFetchCalendarWindow,
  mockFetchTaskActivitySpans,
} = vi.hoisted(() => ({
  mockFetchCalendarWindow: vi.fn().mockResolvedValue([]),
  mockFetchTaskActivitySpans: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../api/calendarWindow", () => ({
  fetchCalendarWindow: (...args: unknown[]) => mockFetchCalendarWindow(...args),
}));

vi.mock("../../api/calendarShare", async () =>
  (await import("../../test/calendarShareApiMock")).calendarShareApiModuleMock());

vi.mock("../../api/tasks", () => ({
  fetchTaskActivitySpans: (...args: unknown[]) => mockFetchTaskActivitySpans(...args),
}));

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../context/AnalysisStatusContext", async () =>
  (await import("../../test/context-mocks")).analysisStatusModuleMock());

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { MONITOR_MODE_KEY, MonitorModeProvider } from "../../context/MonitorModeContext";
import { calendarShareApiMocks, resetCalendarShareApiMocks } from "../../test/calendarShareApiMock";
import { useTimelineData } from "./useTimelineData";
import type { TimelineDataHookResult } from "./useTimelineData.calendar.testHarness";
import { TIMELINE_CALENDAR_TEST_RANGE } from "./useTimelineData.calendar.testHarness";

const ALICE_WORK_CATALOG = ["Alice/Work"];

function Harness({
  refOut,
  selectedSubscribeKeys,
  subscribeCatalogKeys = ALICE_WORK_CATALOG,
}: {
  refOut: { current: TimelineDataHookResult | null };
  selectedSubscribeKeys: string[] | null;
  subscribeCatalogKeys?: readonly string[];
}) {
  const result = useTimelineData({
    selectedSources: null,
    selectedSubscribeKeys,
    subscribeCatalogKeys,
    viewMode: "calendar",
    rangeStart: TIMELINE_CALENDAR_TEST_RANGE.start,
    rangeEnd: TIMELINE_CALENDAR_TEST_RANGE.end,
  });
  refOut.current = result;
  return null;
}

describe("useTimelineData subscribed merge", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let resultRef: { current: TimelineDataHookResult | null };

  beforeEach(() => {
    window.localStorage.setItem(MONITOR_MODE_KEY, "pages");
    mockFetchCalendarWindow.mockReset().mockResolvedValue([]);
    mockFetchTaskActivitySpans.mockReset().mockResolvedValue([]);
    resetCalendarShareApiMocks();
    calendarShareApiMocks.fetchCalendarShareSubscriptionEvents.mockResolvedValue([
      {
        id: "Alice/Work:evt-1",
        source: "subscribed:Alice/Work",
        title: "Busy",
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T10:00:00Z",
        isAllDay: false,
        handle: "Alice",
        slug: "Work",
      },
    ]);
    container = document.createElement("div");
    document.body.appendChild(container);
    resultRef = { current: null };
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
  });

  async function render(
    selectedSubscribeKeys: string[] | null = null,
    extra?: { subscribeCatalogKeys?: readonly string[] },
  ) {
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(
            MonitorModeProvider,
            null,
            createElement(Harness, {
              refOut: resultRef,
              selectedSubscribeKeys,
              subscribeCatalogKeys: extra?.subscribeCatalogKeys,
            }),
          ),
        ),
      );
    });
  }

  it("merges subscribed events as read-only subscribed:handle/slug source", async () => {
    await render(null);
    const events = resultRef.current?.events ?? [];
    expect(events.some((event) => event.source === "subscribed:Alice/Work")).toBe(true);
    expect(events.find((event) => event.source === "subscribed:Alice/Work")?.title).toBe("Busy");
  });

  it("hides subscribed events when the dedicated filter is empty", async () => {
    await render([]);
    expect(calendarShareApiMocks.fetchCalendarShareSubscriptionEvents).not.toHaveBeenCalled();
    expect(resultRef.current?.events ?? []).toEqual([]);
  });

  it("does not fetch subscribed events when mine catalog is empty", async () => {
    await render(null, { subscribeCatalogKeys: [] });
    expect(calendarShareApiMocks.fetchCalendarShareSubscriptionEvents).not.toHaveBeenCalled();
    expect(resultRef.current?.events ?? []).toEqual([]);
  });

  it("null filter shows only mine catalog keys, not extra remote calendars", async () => {
    calendarShareApiMocks.fetchCalendarShareSubscriptionEvents.mockResolvedValue([
      {
        id: "Alice/Work:evt-1",
        source: "subscribed:Alice/Work",
        title: "Busy",
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T10:00:00Z",
        handle: "Alice",
        slug: "Work",
      },
      {
        id: "DemoPub/Open:evt-2",
        source: "subscribed:DemoPub/Open",
        title: "Open Briefing 008",
        startTime: "2025-01-15T17:00:00Z",
        endTime: "2025-01-15T18:00:00Z",
        handle: "DemoPub",
        slug: "Open",
      },
    ]);
    await render(null, { subscribeCatalogKeys: ["Alice/Work"] });
    const events = resultRef.current?.events ?? [];
    expect(events.some((event) => event.source === "subscribed:Alice/Work")).toBe(true);
    expect(events.some((event) => event.source === "subscribed:DemoPub/Open")).toBe(false);
  });

  it("passes subscribed seriesId through to timeline items and leaves one-offs null", async () => {
    calendarShareApiMocks.fetchCalendarShareSubscriptionEvents.mockResolvedValue([
      {
        id: "Alice/Work:evt-1",
        source: "subscribed:Alice/Work",
        title: "Busy",
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T10:00:00Z",
        handle: "Alice",
        slug: "Work",
      },
      {
        id: "Alice/Work:series-weekly:20250115T090000Z",
        source: "subscribed:Alice/Work",
        title: "Weekly standup",
        startTime: "2025-01-22T09:00:00Z",
        endTime: "2025-01-22T10:00:00Z",
        handle: "Alice",
        slug: "Work",
        seriesId: "series-weekly",
      },
    ]);
    await render(null);
    const events = resultRef.current?.events ?? [];
    expect(events.find((event) => event.id === "Alice/Work:evt-1")?.seriesId ?? null).toBeNull();
    expect(events.find((event) => event.id === "Alice/Work:series-weekly:20250115T090000Z")?.seriesId).toBe(
      "series-weekly",
    );
  });

  it("surfaces subscribed fetch errors and keeps last good events", async () => {
    await render(null);
    expect((resultRef.current?.events ?? []).some((event) => event.source === "subscribed:Alice/Work")).toBe(true);
    expect(resultRef.current?.pageError).toBeNull();

    calendarShareApiMocks.fetchCalendarShareSubscriptionEvents.mockRejectedValueOnce(new Error("calendar share 502"));
    await act(async () => {
      await resultRef.current?.refreshEvents();
    });
    expect((resultRef.current?.events ?? []).some((event) => event.source === "subscribed:Alice/Work")).toBe(true);
    expect(resultRef.current?.pageError).toMatch(/502|calendar share/i);
  });
});

