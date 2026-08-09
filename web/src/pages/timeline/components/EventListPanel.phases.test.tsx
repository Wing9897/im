import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { ensureZhHantLocale } from "../../../test/i18nHarness";
import { makeTimelineItem } from "../../../test/analysisEventFixtures";
import {
  resetTaskCatalogState,
  taskCatalogState,
} from "../../../test/context-mocks";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import { renderPanel } from "./eventListPanelTestUtils";

vi.mock("../../../context/TaskCatalogContext", async () =>
  (await import("../../../test/context-mocks")).taskCatalogModuleMock(),
);

describe("EventListPanel", () => {
  beforeEach(async () => {
    await ensureZhHantLocale();
    resetTaskCatalogState();
    taskCatalogState.worksets = [
      {
        id: SYSTEM_WORKSET_ID,
        name: "一般",
        createdAt: null,
        updatedAt: null,
      },
    ];
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 20, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses real-now buckets and 跨日进行中 / 结束于当日 when viewing Aug 8 from Aug 6", () => {
    // Product bug fixture: today Aug 6, selected Aug 8.
    vi.setSystemTime(new Date(2026, 7, 6, 12, 0, 0));
    const trip = makeTimelineItem({
      id: "trip",
      title: "三日出差",
      startTime: new Date(2026, 7, 7, 9, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 9, 18, 0, 0).toISOString(),
    });
    const overnight = makeTimelineItem({
      id: "overnight",
      title: "Overnight Watch",
      startTime: new Date(2026, 7, 7, 8, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 8, 8, 0, 0).toISOString(),
    });
    const alreadyCovering = makeTimelineItem({
      id: "covering",
      title: "Conference Week",
      startTime: new Date(2026, 7, 5, 9, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 10, 18, 0, 0).toISOString(),
    });
    const later = makeTimelineItem({
      id: "later",
      title: "Afternoon Meet",
      startTime: new Date(2026, 7, 8, 14, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 8, 15, 0, 0).toISOString(),
    });
    const startsTonight = makeTimelineItem({
      id: "starts",
      title: "Starts Tonight",
      startTime: new Date(2026, 7, 8, 20, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 9, 8, 0, 0).toISOString(),
    });

    const { container } = renderPanel({
      rangeEvents: [trip, overnight, alreadyCovering, later, startsTonight],
      focusedDay: new Date(2026, 7, 8),
    });

    const filter = container.querySelector(
      '[data-testid="timeline-event-phase-filter"]',
    );
    expect(filter?.textContent).toContain("進行中");
    expect(filter?.textContent).toContain("未開始");
    expect(filter?.textContent).not.toContain("跨日進行中");
    expect(filter?.textContent).not.toContain("結束於本日");
    expect(filter?.textContent).not.toContain("結束於當日");
    expect(
      container.querySelector('[data-testid="timeline-event-phase-filter-ending"]'),
    ).toBeNull();

    const ongoingGroup = container.querySelector(
      '[data-testid="timeline-event-group-ongoing"]',
    );
    const upcomingGroup = container.querySelector(
      '[data-testid="timeline-event-group-upcoming"]',
    );
    // Only already-started covering is 进行中; future trip/overnight stay 未开始.
    expect(ongoingGroup?.textContent).toContain("Conference Week");
    expect(ongoingGroup?.textContent).not.toContain("三日出差");
    expect(upcomingGroup?.textContent).toContain("三日出差");
    expect(upcomingGroup?.textContent).toContain("Overnight Watch");
    expect(upcomingGroup?.textContent).toContain("Afternoon Meet");
    expect(upcomingGroup?.textContent).toContain("Starts Tonight");

    expect(
      container.querySelector(
        '[data-testid="timeline-event-day-phase-ongoing-multi-day"]',
      )?.textContent,
    ).toBe("跨日進行中");
    expect(
      container.querySelector(
        '[data-testid="timeline-event-day-phase-ending-focused"]',
      )?.textContent,
    ).toBe("結束於當日");
    expect(
      container.querySelector(
        '[data-testid="timeline-event-day-phase-ending-today"]',
      ),
    ).toBeNull();
    expect(
      upcomingGroup?.querySelector('[data-testid="timeline-event-cross-day"]'),
    ).toBeNull();
    // Future multi-day cover still shows card span tag (not the old month +N chip).
    expect(
      upcomingGroup?.querySelector(
        '[data-testid="timeline-event-day-phase-ongoing-multi-day"]',
      )?.textContent,
    ).toBe("跨日進行中");
  });

  it("uses 跨日进行中 + 结束于本日 when focused day is real today", () => {
    vi.setSystemTime(new Date(2026, 7, 8, 12, 0, 0));
    const overnight = makeTimelineItem({
      id: "overnight",
      title: "Overnight Watch",
      startTime: new Date(2026, 7, 7, 8, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 8, 8, 0, 0).toISOString(),
    });
    const covering = makeTimelineItem({
      id: "covering",
      title: "Conference Week",
      startTime: new Date(2026, 7, 6, 9, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 10, 18, 0, 0).toISOString(),
    });
    const later = makeTimelineItem({
      id: "later",
      title: "Afternoon Meet",
      startTime: new Date(2026, 7, 8, 14, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 8, 15, 0, 0).toISOString(),
    });

    const { container } = renderPanel({
      rangeEvents: [overnight, covering, later],
      focusedDay: new Date(2026, 7, 8),
    });

    const ongoingGroup = container.querySelector(
      '[data-testid="timeline-event-group-ongoing"]',
    );
    const upcomingGroup = container.querySelector(
      '[data-testid="timeline-event-group-upcoming"]',
    );
    expect(ongoingGroup?.textContent).toContain("Overnight Watch");
    expect(ongoingGroup?.textContent).toContain("Conference Week");
    expect(upcomingGroup?.textContent).toContain("Afternoon Meet");

    expect(
      ongoingGroup?.querySelector(
        '[data-testid="timeline-event-day-phase-ending-today"]',
      )?.textContent,
    ).toBe("結束於本日");
    expect(
      ongoingGroup?.querySelector(
        '[data-testid="timeline-event-day-phase-ongoing-multi-day"]',
      )?.textContent,
    ).toBe("跨日進行中");
  });


  it("groups into 進行中 / 未開始 and folds clock-ended into 进行中", () => {
    vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
    const upcoming = makeTimelineItem({
      id: "up",
      title: "Upcoming Meet",
      startTime: new Date(2026, 6, 15, 14, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 15, 15, 0, 0).toISOString(),
    });
    const ongoing = makeTimelineItem({
      id: "on",
      title: "Ongoing Meet",
      startTime: new Date(2026, 6, 15, 10, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 15, 14, 0, 0).toISOString(),
    });
    const ended = makeTimelineItem({
      id: "en",
      title: "Ended Meet",
      startTime: new Date(2026, 6, 15, 8, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 15, 9, 0, 0).toISOString(),
    });

    const { container } = renderPanel({
      rangeEvents: [upcoming, ongoing, ended],
      focusedDay: new Date(2026, 6, 15),
    });

    expect(container.textContent).toContain("未開始");
    expect(container.textContent).toContain("進行中");
    expect(container.textContent).not.toContain("目前已完結");
    expect(
      container.querySelector('[data-testid="timeline-event-group-upcoming"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="timeline-event-group-ongoing"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="timeline-event-group-ending"]'),
    ).toBeNull();

    const upcomingGroup = container.querySelector(
      '[data-testid="timeline-event-group-upcoming"]',
    );
    const ongoingGroup = container.querySelector(
      '[data-testid="timeline-event-group-ongoing"]',
    );
    expect(upcomingGroup?.textContent).toContain("Upcoming Meet");
    expect(ongoingGroup?.textContent).toContain("Ongoing Meet");
    expect(ongoingGroup?.textContent).toContain("Ended Meet");
  });

  it("quick-filters the list to one phase bucket", () => {
    vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
    const upcoming = makeTimelineItem({
      id: "up",
      title: "Upcoming Meet",
      startTime: new Date(2026, 6, 15, 14, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 15, 15, 0, 0).toISOString(),
    });
    const ongoing = makeTimelineItem({
      id: "on",
      title: "Ongoing Meet",
      startTime: new Date(2026, 6, 15, 10, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 15, 14, 0, 0).toISOString(),
    });
    const { container } = renderPanel({
      rangeEvents: [upcoming, ongoing],
      focusedDay: new Date(2026, 6, 15),
    });

    const upcomingChip = container.querySelector(
      '[data-testid="timeline-event-phase-filter-upcoming"]',
    ) as HTMLButtonElement | null;
    expect(upcomingChip).not.toBeNull();
    expect(upcomingChip?.textContent).toBe("未開始");
    act(() => {
      upcomingChip?.click();
    });
    expect(
      container.querySelector('[data-testid="timeline-event-group-upcoming"]')
        ?.textContent,
    ).toContain("Upcoming Meet");
    expect(
      container.querySelector('[data-testid="timeline-event-group-ongoing"]'),
    ).toBeNull();
  });

  it("hides empty time-phase groups", () => {
    vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
    const upcoming = makeTimelineItem({
      id: "up-only",
      title: "Only Upcoming",
      startTime: new Date(2026, 6, 15, 14, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 15, 15, 0, 0).toISOString(),
    });

    const { container } = renderPanel({
      rangeEvents: [upcoming],
      focusedDay: new Date(2026, 6, 15),
    });

    expect(
      container.querySelector('[data-testid="timeline-event-group-upcoming"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="timeline-event-group-ongoing"]'),
    ).toBeNull();
    expect(container.textContent).toContain("未開始");
  });

});
