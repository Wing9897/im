import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, act, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { buildCalendarDays } from "../../../domain/timeline/dateUtils";
import { DEFAULT_WORKSET_COVER_URL } from "../../../domain/worksets/worksetCover";
import { makeEvent } from "../../../test/timelineTestHelpers";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";
import { TimelineSplitMonthCard } from "./TimelineSplitMonthCard";

const here = dirname(fileURLToPath(import.meta.url));
const timelineCss = readFileSync(resolve(here, "../../../css/timeline-page.css"), "utf8");

let lastRoot: Root | null = null;
let lastContainer: HTMLDivElement | null = null;

afterEach(() => {
  if (lastRoot) {
    act(() => lastRoot!.unmount());
    lastRoot = null;
  }
  lastContainer?.remove();
  lastContainer = null;
});

function renderCard(
  overrides: Partial<Parameters<typeof TimelineSplitMonthCard>[0]> = {},
) {
  const monthCursor = new Date(2025, 0, 1);
  const popoverRef: RefObject<HTMLDivElement | null> = { current: null };
  const props = {
    title: "Alpha",
    kind: "workset" as const,
    events: [] as Parameters<typeof TimelineSplitMonthCard>[0]["events"],
    monthCursor,
    monthDays: buildCalendarDays(monthCursor),
    selectedDay: null as Date | null,
    openDay: null as Date | null,
    popoverRef,
    onToggleDay: vi.fn(),
    onSelectEvent: vi.fn(),
    onFocusDay: vi.fn(),
    onClosePopover: vi.fn(),
    ...overrides,
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  lastRoot = root;
  lastContainer = container;
  act(() => {
    root.render(wrapWithI18n(createElement(TimelineSplitMonthCard, props)));
  });
  return { container, props };
}

function popoverEl() {
  return document.querySelector('[data-testid="timeline-split-month-popover"]');
}

function jan15(container: HTMLElement) {
  return container.querySelector('[data-testid="timeline-split-month-day"][data-day="2025-01-15"]');
}

describe("TimelineSplitMonthCard", () => {
  it("renders one day number and event dots without titles or watermarks", async () => {
    await ensureZhHantLocale();
    const events = [
      makeEvent({ id: "e1", title: "Kickoff Meeting", startTime: "2025-01-15T09:00:00" }),
      makeEvent({ id: "e2", title: "Standup", startTime: "2025-01-15T10:00:00" }),
      makeEvent({ id: "e3", title: "Review", startTime: "2025-01-15T11:00:00" }),
      makeEvent({ id: "e4", title: "Wrap", startTime: "2025-01-15T12:00:00" }),
    ];
    const { container } = renderCard({ events });
    const cell = jan15(container);
    expect(cell).not.toBeNull();
    expect(cell?.querySelectorAll('[data-testid="timeline-split-month-day-number"]')).toHaveLength(1);
    expect(cell?.querySelector('[data-testid="timeline-split-month-day-number"]')?.textContent).toBe("15");
    expect(cell?.querySelectorAll('[data-testid="timeline-split-month-dot"]')).toHaveLength(3);
    expect(cell?.textContent).not.toContain("Kickoff Meeting");
    expect(cell?.textContent).not.toContain("Standup");
    expect(cell?.textContent).not.toMatch(/\+\d/);
    expect(container.querySelector('[data-testid="timeline-month-day-watermark"]')).toBeNull();
    expect(container.querySelector('[data-testid="timeline-month-day-weather"]')).toBeNull();
    expect(container.querySelector('[data-testid="timeline-month-day-cell"]')).toBeNull();
    expect(container.querySelector('[data-testid="timeline-month-grid"]')).toBeNull();
    expect(container.querySelector('[data-testid="timeline-month-card-month"]')).toBeNull();
    expect(container.textContent).not.toContain("2025年1月");
  });

  it("applies a chosen accent to event dots and omits the month subtitle", async () => {
    await ensureZhHantLocale();
    const events = [
      makeEvent({ id: "e1", title: "Kickoff Meeting", startTime: "2025-01-15T09:00:00" }),
    ];
    const { container } = renderCard({ events, accentColor: { kind: "preset", id: "sky" } });
    const card = container.querySelector('[data-testid="timeline-month-card"]');
    expect(card?.getAttribute("data-card-color")).toBe("sky");
    expect(card?.getAttribute("style")).toContain("--split-month-card-dot");
    expect(card?.style.getPropertyValue("--split-month-card-dot")).toBe("var(--info)");
    expect(card?.style.getPropertyValue("--split-month-card-accent")).toBe("var(--info)");
    expect(jan15(container)?.querySelectorAll('[data-testid="timeline-split-month-dot"]')).toHaveLength(
      1,
    );
    expect(container.querySelector('[data-testid="timeline-month-card-month"]')).toBeNull();
  });

  it("applies a custom hex accent to event dots and the top border", async () => {
    await ensureZhHantLocale();
    const events = [
      makeEvent({ id: "e1", title: "Kickoff Meeting", startTime: "2025-01-15T09:00:00" }),
    ];
    const { container } = renderCard({
      events,
      accentColor: { kind: "hex", value: "#c45c3e" },
    });
    const card = container.querySelector('[data-testid="timeline-month-card"]');
    expect(card?.getAttribute("data-card-color")).toBe("#c45c3e");
    expect(card?.style.getPropertyValue("--split-month-card-dot")).toBe("#c45c3e");
    expect(card?.style.getPropertyValue("--split-month-card-accent")).toBe("#c45c3e");
    expect(jan15(container)?.querySelectorAll('[data-testid="timeline-split-month-dot"]')).toHaveLength(
      1,
    );
  });

  it("lists the day's events in a portaled popover", async () => {
    await ensureZhHantLocale();
    const events = [
      makeEvent({ id: "e1", title: "Kickoff Meeting", startTime: "2025-01-15T09:00:00" }),
      makeEvent({ id: "e2", title: "Standup", startTime: "2025-01-15T10:00:00" }),
    ];
    const onSelectEvent = vi.fn();
    const { container } = renderCard({
      events,
      openDay: new Date(2025, 0, 15),
      onSelectEvent,
    });
    const popover = popoverEl();
    const card = container.querySelector('[data-testid="timeline-month-card"]');
    expect(popover).not.toBeNull();
    expect(popover?.parentElement).toBe(document.body);
    expect(card?.contains(popover)).toBe(false);
    expect((popover as HTMLElement).style.position).toBe("fixed");
    expect(popover?.getAttribute("aria-label")).toContain("事件");
    const rows = document.querySelectorAll('[data-testid="timeline-split-month-popover-row"]');
    expect(rows).toHaveLength(2);
    expect(popover?.textContent).toContain("Kickoff Meeting");
    expect(popover?.textContent).toContain("Standup");
    act(() => {
      rows[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onSelectEvent).toHaveBeenCalledWith(expect.objectContaining({ id: "e1" }));
  });

  it("flips the last-row popover above the cell so it is not clipped", async () => {
    await ensureZhHantLocale();
    const events = [
      makeEvent({ id: "e1", title: "dasfasf", startTime: "2025-01-31T14:19:00" }),
      makeEvent({ id: "e2", title: "sagvdsbx", startTime: "2025-01-31T14:20:00" }),
    ];
    const { container } = renderCard({
      events,
      openDay: new Date(2025, 0, 31),
    });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
    const cell = container.querySelector(
      '[data-testid="timeline-split-month-day"][data-day="2025-01-31"]',
    ) as HTMLElement;
    const popover = popoverEl() as HTMLElement;
    expect(popover).not.toBeNull();
    cell.getBoundingClientRect = () =>
      ({
        top: 540,
        left: 200,
        width: 40,
        height: 28,
        bottom: 568,
        right: 240,
        x: 200,
        y: 540,
        toJSON() {
          return this;
        },
      }) as DOMRect;
    Object.defineProperty(popover, "offsetHeight", { configurable: true, value: 80 });
    Object.defineProperty(popover, "offsetWidth", { configurable: true, value: 160 });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(popover.getAttribute("data-placement")).toBe("above");
    expect(popover.style.position).toBe("fixed");
    expect(Number.parseFloat(popover.style.top)).toBeLessThan(540);
  });

  it("shows empty copy and create on an empty day", async () => {
    await ensureZhHantLocale();
    const onCreateOnDay = vi.fn();
    renderCard({
      openDay: new Date(2025, 0, 16),
      onCreateOnDay,
    });
    expect(document.querySelector('[data-testid="timeline-split-month-popover-empty"]')?.textContent).toContain(
      "這天沒有事件",
    );
    const add = document.querySelector('[data-testid="timeline-split-month-popover-add"]');
    expect(add?.textContent).toContain("新增事件");
    act(() => {
      add?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onCreateOnDay).toHaveBeenCalledTimes(1);
  });

  it("applies the active ring only when this card has a selectedDay", async () => {
    await ensureZhHantLocale();
    const { container } = renderCard({
      selectedDay: new Date(2025, 0, 15),
      openDay: new Date(2025, 0, 15),
    });
    const selected = jan15(container);
    const other = container.querySelector(
      '[data-testid="timeline-split-month-day"][data-day="2025-01-16"]',
    );
    expect(selected?.className).toContain("is-active");
    expect(selected?.className).toContain("is-open");
    expect(selected?.getAttribute("aria-pressed")).toBe("true");
    expect(other?.className).not.toContain("is-active");
    expect(other?.className).not.toContain("is-open");
    expect(other?.getAttribute("aria-pressed")).toBe("false");
  });

  it("does not treat a missing selectedDay as a shared focused day", async () => {
    await ensureZhHantLocale();
    const { container } = renderCard();
    const days = container.querySelectorAll('[data-testid="timeline-split-month-day"]');
    expect(days.length).toBeGreaterThan(0);
    expect([...days].every((day) => !day.className.includes("is-active"))).toBe(true);
    expect([...days].every((day) => day.getAttribute("aria-pressed") === "false")).toBe(true);
  });

  it("shows a subscribe icon on subscribed calendar cards, not worksets", async () => {
    await ensureZhHantLocale();
    const workset = renderCard({ title: "一般", kind: "workset" });
    expect(workset.container.querySelector('[data-testid="timeline-month-card-subscribe-icon"]')).toBeNull();
    expect(workset.container.querySelector('[data-card-kind="workset"]')).not.toBeNull();

    act(() => lastRoot!.unmount());
    lastRoot = null;
    lastContainer?.remove();
    lastContainer = null;

    const subscribed = renderCard({ title: "DemoPub/Busy", kind: "subscribe" });
    const icon = subscribed.container.querySelector('[data-testid="timeline-month-card-subscribe-icon"]');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("aria-label")).toBe("訂閱日曆");
    expect(icon?.parentElement?.getAttribute("title")).toBe("已訂閱");
    const header = subscribed.container.querySelector(".im-split-month-header");
    const title = subscribed.container.querySelector(".im-split-month-title");
    expect(header?.contains(icon)).toBe(true);
    expect(title?.nextElementSibling).toBe(icon?.parentElement);
  });

  it("renders a cover strip between the title and weekday row", async () => {
    await ensureZhHantLocale();
    const { container } = renderCard({ cover: "data:image/jpeg;base64,cover-a" });
    const cover = container.querySelector('[data-testid="timeline-month-card-cover"]');
    const header = container.querySelector(".im-split-month-header");
    const weekdays = container.querySelector(".im-split-month-weekdays");
    expect(cover).not.toBeNull();
    expect(cover?.className).toContain("im-split-month-cover");
    expect(cover?.querySelector("img")?.getAttribute("src")).toBe("data:image/jpeg;base64,cover-a");
    expect(container.querySelector('[data-testid="workset-card-cover-upload"]')).toBeNull();
    expect(cover?.querySelector('input[type="file"]')).toBeNull();
    expect(header?.nextElementSibling).toBe(cover);
    expect(cover?.nextElementSibling).toBe(weekdays);
  });

  it("renders a muted cover placeholder when cover is empty and does not crash", async () => {
    await ensureZhHantLocale();
    const { container } = renderCard({ cover: "" });
    const cover = container.querySelector('[data-testid="timeline-month-card-cover"]');
    expect(cover).not.toBeNull();
    expect(cover?.querySelector("img")?.getAttribute("src")).toBe(DEFAULT_WORKSET_COVER_URL);
    expect(container.querySelector('[data-testid="timeline-month-card"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="timeline-split-month-day"]').length).toBeGreaterThan(0);
  });

  it("sizes the cover like subscription cards (2.4/1, object-cover, no short-strip cap)", () => {
    const coverRule = timelineCss.match(/\.im-split-month-cover\s*\{[^}]+\}/)?.[0] ?? "";
    const imgRule = timelineCss.match(/\.im-split-month-cover img\s*\{[^}]+\}/)?.[0] ?? "";
    expect(coverRule).toContain("aspect-ratio: 2.4 / 1");
    expect(coverRule).not.toMatch(/max-height\s*:/);
    expect(imgRule).toContain("object-fit: cover");
    expect(imgRule).toContain("height: 100%");
    expect(imgRule).toContain("width: 100%");
  });

  it("does not mark another month's same day-of-month as selected", async () => {
    await ensureZhHantLocale();
    const monthCursor = new Date(2026, 7, 1);
    const { container } = renderCard({
      monthCursor,
      monthDays: buildCalendarDays(monthCursor),
      selectedDay: new Date(2026, 7, 31),
    });
    expect(
      container.querySelector('[data-testid="timeline-split-month-day"][data-day="2026-08-31"]')
        ?.className,
    ).toContain("is-active");
    expect(
      container.querySelector('[data-testid="timeline-split-month-day"][data-day="2026-07-31"]')
        ?.className,
    ).not.toContain("is-active");
  });
});
