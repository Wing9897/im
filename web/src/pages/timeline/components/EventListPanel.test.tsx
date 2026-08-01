import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";

import { EventListPanel, previewEventBody } from "./EventListPanel";
import { makeTimelineItem } from "../../../test/analysisEventFixtures";

function makeEvent(id: string, title: string, body = "") {
  return makeTimelineItem({
    id,
    title,
    body,
    startTime: "2026-07-14T00:00:00.000Z",
    endTime: "2026-07-15T00:00:00.000Z",
  });
}

function renderPanel(props: {
  rangeEvents: ReturnType<typeof makeEvent>[];
  allRangeEvents: ReturnType<typeof makeEvent>[];
  hasDayFocus: boolean;
  onSelectEvent?: () => void;
}) {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(EventListPanel, {
          ...props,
          onSelectEvent: props.onSelectEvent ?? (() => {}),
        }),
      ),
    );
  });
  return { container, root };
}

describe("previewEventBody", () => {
  it("collapses multiline whitespace for list preview", () => {
    expect(previewEventBody("line1\n\nline2   line3")).toBe("line1 line2 line3");
  });
});

describe("EventListPanel", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
    vi.useFakeTimers();
    // Local noon — past the default makeEvent window (Jul 14–15 UTC)
    vi.setSystemTime(new Date(2026, 6, 20, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to該日 list when hasDayFocus becomes true", () => {
    const dayEvent = makeEvent("day", "Day Event");
    const otherEvent = makeEvent("other", "Other Event");
    const { container, root } = renderPanel({
      rangeEvents: [dayEvent],
      allRangeEvents: [dayEvent, otherEvent],
      hasDayFocus: false,
    });

    expect(container.textContent).toContain("Other Event");

    act(() => {
      root.render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(EventListPanel, {
            rangeEvents: [dayEvent],
            allRangeEvents: [dayEvent, otherEvent],
            hasDayFocus: true,
            onSelectEvent: () => {},
          }),
        ),
      );
    });

    expect(container.textContent).toContain("Day Event");
    expect(container.textContent).not.toContain("Other Event");
    expect(container.textContent).toContain("該日 (1)");
  });

  it("renders multiline body as a single truncated preview line", () => {
    const event = makeEvent(
      "body-1",
      "Polymarket title",
      "第一行摘要\n\n第二行細節\n第三行",
    );
    const { container } = renderPanel({
      rangeEvents: [event],
      allRangeEvents: [event],
      hasDayFocus: false,
    });

    expect(container.textContent).toContain("第一行摘要 第二行細節 第三行");
    expect(container.querySelector(".line-clamp-2")).toBeNull();
    const preview = container.querySelector(".truncate.text-text-secondary") as HTMLElement | null;
    expect(preview?.getAttribute("title")).toContain("第一行摘要");
  });

  it("keeps event cards in a dedicated scroll container with shrink-0", () => {
    const events = Array.from({ length: 20 }, (_, index) =>
      makeEvent(`e-${index}`, `Event ${index}`),
    );
    const { container } = renderPanel({
      rangeEvents: events,
      allRangeEvents: events,
      hasDayFocus: false,
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

  it("groups events into upcoming / ongoing / ended with horizontal dividers", () => {
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
      allRangeEvents: [upcoming, ongoing, ended],
      hasDayFocus: false,
    });

    expect(container.textContent).toContain("即將到來");
    expect(container.textContent).toContain("進行中");
    expect(container.textContent).toContain("完結");
    expect(
      container.querySelector('[data-testid="timeline-event-group-upcoming"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="timeline-event-group-ongoing"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="timeline-event-group-ended"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="timeline-event-group-upcoming-divider"]'),
    ).not.toBeNull();

    const upcomingGroup = container.querySelector(
      '[data-testid="timeline-event-group-upcoming"]',
    );
    const ongoingGroup = container.querySelector(
      '[data-testid="timeline-event-group-ongoing"]',
    );
    const endedGroup = container.querySelector(
      '[data-testid="timeline-event-group-ended"]',
    );
    expect(upcomingGroup?.textContent).toContain("Upcoming Meet");
    expect(ongoingGroup?.textContent).toContain("Ongoing Meet");
    expect(endedGroup?.textContent).toContain("Ended Meet");
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
      allRangeEvents: [upcoming],
      hasDayFocus: false,
    });

    expect(
      container.querySelector('[data-testid="timeline-event-group-upcoming"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="timeline-event-group-ongoing"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="timeline-event-group-ended"]'),
    ).toBeNull();
    expect(container.textContent).toContain("即將到來");
    expect(container.textContent).not.toContain("進行中");
    expect(container.textContent).not.toContain("完結");
  });

  it("keeps click selection on grouped event cards", () => {
    vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
    const upcoming = makeTimelineItem({
      id: "click-me",
      title: "Click Me",
      startTime: new Date(2026, 6, 15, 14, 0, 0).toISOString(),
      endTime: new Date(2026, 6, 15, 15, 0, 0).toISOString(),
    });
    const picked: string[] = [];
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(EventListPanel, {
            rangeEvents: [upcoming],
            allRangeEvents: [upcoming],
            hasDayFocus: false,
            onSelectEvent: (event) => {
              picked.push(event?.id ?? "");
            },
          }),
        ),
      );
    });

    const clickButton = container.querySelector("button");
    expect(clickButton).not.toBeNull();
    act(() => {
      clickButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(picked).toEqual(["click-me"]);
  });
});
