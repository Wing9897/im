import { describe, expect, it, vi } from "vitest";
import { createElement, act, type RefObject } from "react";
import { createRoot } from "react-dom/client";
import { buildCalendarDays } from "../../../domain/timeline/dateUtils";
import { makeEvent } from "../../../test/timelineTestHelpers";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";
import { TimelineSplitMonthCard } from "./TimelineSplitMonthCard";

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
  act(() => {
    createRoot(container).render(wrapWithI18n(createElement(TimelineSplitMonthCard, props)));
  });
  return { container, props };
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

  it("lists the day's events in an in-card popover", async () => {
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
    const popover = container.querySelector('[data-testid="timeline-split-month-popover"]');
    expect(popover).not.toBeNull();
    expect(popover?.getAttribute("aria-label")).toContain("事件");
    const rows = container.querySelectorAll('[data-testid="timeline-split-month-popover-row"]');
    expect(rows).toHaveLength(2);
    expect(popover?.textContent).toContain("Kickoff Meeting");
    expect(popover?.textContent).toContain("Standup");
    act(() => {
      rows[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onSelectEvent).toHaveBeenCalledWith(expect.objectContaining({ id: "e1" }));
  });

  it("shows empty copy and create on an empty day", async () => {
    await ensureZhHantLocale();
    const onCreateOnDay = vi.fn();
    const { container } = renderCard({
      openDay: new Date(2025, 0, 16),
      onCreateOnDay,
    });
    expect(container.querySelector('[data-testid="timeline-split-month-popover-empty"]')?.textContent).toContain(
      "這天沒有事件",
    );
    const add = container.querySelector('[data-testid="timeline-split-month-popover-add"]');
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
