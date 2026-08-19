import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { ensureZhHantLocale } from "../../../test/i18nHarness";
import {
  resetTaskCatalogState,
  taskCatalogState,
} from "../../../test/context-mocks";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import { makeEvent, renderPanel } from "./eventListPanelTestUtils";

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

  it("shows only the date in the list header (no 本日 prefix)", () => {
    const dayEvent = makeEvent("day", "Day Event");
    const focusedDay = new Date(2026, 6, 14);
    const { container } = renderPanel({
      rangeEvents: [dayEvent],
      focusedDay,
    });

    expect(container.textContent).toContain("Day Event");
    const dayLabel = container.querySelector(
      '[data-testid="timeline-event-list-day-label"]',
    );
    const filter = container.querySelector(
      '[data-testid="timeline-event-phase-filter"]',
    );
    expect(dayLabel).not.toBeNull();
    expect(dayLabel?.textContent).not.toContain("本日");
    expect(dayLabel?.textContent).toMatch(/14/);
    expect(dayLabel?.className).toContain("self-center");
    expect(filter).not.toBeNull();
    const header = container.querySelector(
      '[data-testid="timeline-event-list-header"]',
    );
    expect(header).not.toBeNull();
    expect(header?.className).toContain("items-center");
    expect(header?.className).toContain("justify-between");
    expect(dayLabel?.parentElement).toBe(header);
    expect(filter?.parentElement).toBe(header);
    expect(container.textContent).not.toContain("全範圍");
  });

  it("keeps sidebar cards rounded and filter/date row vertically aligned", () => {
    const dayEvent = makeEvent("day", "Day Event");
    const { container } = renderPanel({
      rangeEvents: [dayEvent],
      focusedDay: new Date(2026, 6, 14),
    });

    const card = container.querySelector(".im-timeline-event-list-item");
    expect(card?.className).toContain("rounded-xl");
    const header = container.querySelector(
      '[data-testid="timeline-event-list-header"]',
    );
    expect(header?.className).toContain("items-center");
  });


  it("renders multiline body as a single truncated preview line", () => {
    const event = makeEvent(
      "body-1",
      "Polymarket title",
      "第一行摘要\n\n第二行細節\n第三行",
    );
    const { container } = renderPanel({
      rangeEvents: [event],
      focusedDay: new Date(2026, 6, 14),
    });

    expect(container.textContent).toContain("第一行摘要 第二行細節 第三行");
    expect(container.querySelector(".line-clamp-2")).toBeNull();
    const preview = container.querySelector('[title*="第一行摘要"]');
    expect(preview).not.toBeNull();
    expect(preview?.querySelector(".truncate")).not.toBeNull();
  });

  it("keeps event cards in a dedicated scroll container with shrink-0", () => {
    const events = Array.from({ length: 20 }, (_, index) =>
      makeEvent(`e-${index}`, `Event ${index}`),
    );
    const { container } = renderPanel({
      rangeEvents: events,
      focusedDay: new Date(2026, 6, 14),
    });

    const scroll = container.querySelector(
      '[data-testid="timeline-event-list-scroll"]',
    ) as HTMLElement | null;
    expect(scroll).not.toBeNull();
    expect(scroll?.className).toContain("overflow-y-auto");
    expect(scroll?.className).toContain("im-timeline-event-list");
    expect(container.textContent).toContain("Event 19");
    expect(container.querySelectorAll(".im-timeline-event-list-item").length).toBe(20);
    expect(
      container.querySelector(".im-timeline-event-list-item")?.className,
    ).toContain("shrink-0");
    expect(
      container.querySelector(".im-timeline-event-list-item")?.className,
    ).toContain("im-card-hover");
  });

});
