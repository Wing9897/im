import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { TIMELINE_BLOCK_CARD_COLORS_STORAGE_KEY } from "../../../domain/prefs";
import { BLOCK_CARD_COLOR_CSS } from "../../../domain/timeline/blockCardColors";
import { buildCalendarDays } from "../../../domain/timeline/dateUtils";
import { makeEvent } from "../../../test/timelineTestHelpers";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";
import { TimelineMonthCardsGrid } from "./TimelineMonthCardsGrid";

function renderGrid(
  overrides: Partial<Parameters<typeof TimelineMonthCardsGrid>[0]> = {},
) {
  const monthCursor = new Date(2025, 0, 1);
  const props = {
    cards: [] as Parameters<typeof TimelineMonthCardsGrid>[0]["cards"],
    omitted: 0,
    monthCursor,
    monthDays: buildCalendarDays(monthCursor),
    onSelectEvent: vi.fn(),
    onFocusDay: vi.fn(),
    ...overrides,
  };
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(wrapWithI18n(createElement(TimelineMonthCardsGrid, props)));
  });
  return { container, props };
}

const sampleCards: Parameters<typeof TimelineMonthCardsGrid>[0]["cards"] = [
  {
    kind: "workset",
    worksetId: "ws-a",
    title: "Alpha",
    events: [makeEvent({ id: "e1", worksetId: "ws-a", title: "Kickoff Meeting", startTime: "2025-01-15T09:00:00" })],
  },
  {
    kind: "subscribe",
    key: "Alice/Work",
    title: "Alice/Work",
    events: [],
  },
];

describe("TimelineMonthCardsGrid", () => {
  beforeEach(() => {
    window.localStorage.removeItem(TIMELINE_BLOCK_CARD_COLORS_STORAGE_KEY);
  });

  afterEach(() => {
    window.localStorage.removeItem(TIMELINE_BLOCK_CARD_COLORS_STORAGE_KEY);
  });

  it("shows the empty hint and no cards when the list is empty", async () => {
    await ensureZhHantLocale();
    const { container } = renderGrid();
    expect(container.querySelector('[data-testid="timeline-month-cards-empty"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="timeline-month-card"]')).toBeNull();
    expect(container.textContent).toContain("明確勾選");
    expect(container.textContent).toContain("塊");
  });

  it("tells the user that select-all will not expand when the catalog is too large", async () => {
    await ensureZhHantLocale();
    const { container } = renderGrid({ emptyReason: "select_all" });
    expect(container.textContent).toContain("全選不會展開塊");
    expect(container.textContent).toContain("請只勾要看的");
  });

  it("renders split cards with the same grid class and no large-month chrome", async () => {
    await ensureZhHantLocale();
    const { container } = renderGrid({ cards: sampleCards });
    const cards = container.querySelectorAll('[data-testid="timeline-month-card"]');
    expect(cards).toHaveLength(2);
    expect(container.querySelector('[data-testid="timeline-month-card-month"]')).toBeNull();
    expect(container.textContent).not.toContain("2025年1月");
    expect(container.querySelector('[data-testid="timeline-month-grid"]')).toBeNull();
    expect(container.querySelector('[data-testid="timeline-month-day-weather"]')).toBeNull();
    const grids = [...container.querySelectorAll('[data-testid="timeline-split-month-grid"]')];
    expect(grids).toHaveLength(2);
    expect(grids.every((grid) => grid.className.includes("im-split-month-days"))).toBe(true);
    expect(cards[0]?.className).toBe(cards[1]?.className);
    expect(cards[0]?.className).toContain("im-split-month-card");
    expect(cards[0]?.getAttribute("data-card-kind")).toBe("workset");
    expect(cards[1]?.getAttribute("data-card-kind")).toBe("subscribe");
  });

  it("opens one in-card popover at a time and closes on Escape or outside click", async () => {
    await ensureZhHantLocale();
    const { container } = renderGrid({ cards: sampleCards });
    document.body.appendChild(container);
    const busyDay = container.querySelector(
      '[data-card-kind="workset"] [data-testid="timeline-split-month-day"][data-day="2025-01-15"]',
    );
    const emptyDay = container.querySelector(
      '[data-card-kind="subscribe"] [data-testid="timeline-split-month-day"][data-day="2025-01-16"]',
    );
    expect(busyDay).not.toBeNull();
    try {
      act(() => {
        busyDay?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(container.querySelectorAll('[data-testid="timeline-split-month-popover"]')).toHaveLength(1);
      expect(container.querySelector('[data-testid="timeline-split-month-popover"]')?.textContent).toContain(
        "Kickoff Meeting",
      );
      act(() => {
        emptyDay?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(container.querySelectorAll('[data-testid="timeline-split-month-popover"]')).toHaveLength(1);
      expect(container.querySelector('[data-testid="timeline-split-month-popover-empty"]')).not.toBeNull();
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      });
      expect(container.querySelector('[data-testid="timeline-split-month-popover"]')).toBeNull();
      act(() => {
        busyDay?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(container.querySelector('[data-testid="timeline-split-month-popover"]')).not.toBeNull();
      act(() => {
        document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      });
      expect(container.querySelector('[data-testid="timeline-split-month-popover"]')).toBeNull();
    } finally {
      container.remove();
    }
  });

  it("highlights a clicked day only on that card, not the same date on other cards", async () => {
    await ensureZhHantLocale();
    const { container, props } = renderGrid({ cards: sampleCards });
    document.body.appendChild(container);
    const worksetDay = () =>
      container.querySelector(
        '[data-card-kind="workset"] [data-testid="timeline-split-month-day"][data-day="2025-01-15"]',
      );
    const subscribeSameDay = () =>
      container.querySelector(
        '[data-card-kind="subscribe"] [data-testid="timeline-split-month-day"][data-day="2025-01-15"]',
      );
    const subscribeOtherDay = () =>
      container.querySelector(
        '[data-card-kind="subscribe"] [data-testid="timeline-split-month-day"][data-day="2025-01-16"]',
      );
    try {
      expect(worksetDay()?.className).not.toContain("is-active");
      expect(subscribeSameDay()?.className).not.toContain("is-active");
      act(() => {
        worksetDay()?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(props.onFocusDay).toHaveBeenCalledWith(expect.any(Date));
      expect(worksetDay()?.className).toContain("is-active");
      expect(worksetDay()?.className).toContain("is-open");
      expect(subscribeSameDay()?.className).not.toContain("is-active");
      expect(subscribeSameDay()?.className).not.toContain("is-open");
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      });
      expect(container.querySelector('[data-testid="timeline-split-month-popover"]')).toBeNull();
      expect(worksetDay()?.className).toContain("is-active");
      expect(worksetDay()?.className).not.toContain("is-open");
      expect(subscribeSameDay()?.className).not.toContain("is-active");
      act(() => {
        subscribeOtherDay()?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(subscribeOtherDay()?.className).toContain("is-active");
      expect(worksetDay()?.className).not.toContain("is-active");
      expect(subscribeSameDay()?.className).not.toContain("is-active");
    } finally {
      container.remove();
    }
  });

  it("keeps today on every card and the selected ring only on the clicked card", async () => {
    await ensureZhHantLocale();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 30, 15, 0, 0));
    const monthCursor = new Date(2026, 7, 1);
    const { container } = renderGrid({
      cards: [
        ...sampleCards,
        { kind: "subscribe", key: "Bob/Open", title: "Bob/Open", events: [] },
      ],
      monthCursor,
      monthDays: buildCalendarDays(monthCursor),
    });
    document.body.appendChild(container);
    const dayIn = (card: Element, date: string) =>
      card.querySelector(`[data-testid="timeline-split-month-day"][data-day="${date}"]`);
    try {
      const cards = [...container.querySelectorAll('[data-testid="timeline-month-card"]')];
      expect(cards).toHaveLength(3);
      for (const card of cards) {
        expect(dayIn(card, "2026-08-30")?.className).toContain("is-today");
        expect(dayIn(card, "2026-08-31")?.className).not.toContain("is-today");
        expect(dayIn(card, "2026-08-31")?.className).not.toContain("is-active");
        expect(dayIn(card, "2026-07-31")?.className).not.toContain("is-active");
      }
      act(() => {
        dayIn(cards[2]!, "2026-08-31")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(dayIn(cards[2]!, "2026-08-31")?.className).toContain("is-active");
      expect(dayIn(cards[0]!, "2026-08-31")?.className).not.toContain("is-active");
      expect(dayIn(cards[1]!, "2026-08-31")?.className).not.toContain("is-active");
      for (const card of cards) {
        expect(dayIn(card, "2026-08-30")?.className).toContain("is-today");
        expect(dayIn(card, "2026-07-31")?.className).not.toContain("is-active");
      }
    } finally {
      container.remove();
      vi.useRealTimers();
    }
  });

  it("shows the omitted hint when the soft cap dropped cards", async () => {
    await ensureZhHantLocale();
    const { container } = renderGrid({
      omitted: 3,
      cards: [
        {
          kind: "workset",
          worksetId: "ws-a",
          title: "Alpha",
          events: [],
        },
      ],
    });
    expect(container.querySelector('[data-testid="timeline-month-cards-omitted"]')?.textContent).toContain("3");
  });

  it("persists a chosen card color by source identity and paints that card's dots", async () => {
    await ensureZhHantLocale();
    window.localStorage.setItem(
      TIMELINE_BLOCK_CARD_COLORS_STORAGE_KEY,
      JSON.stringify({ "subscribe:Alice/Work": "rose" }),
    );
    const { container } = renderGrid({ cards: sampleCards });
    const worksetCard = () =>
      container.querySelector('[data-card-kind="workset"][data-testid="timeline-month-card"]');
    const subscribeCard = () =>
      container.querySelector('[data-card-kind="subscribe"][data-testid="timeline-month-card"]');
    expect(subscribeCard()?.getAttribute("data-card-color")).toBe("rose");
    expect(subscribeCard()?.style.getPropertyValue("--split-month-card-dot")).toBe(
      BLOCK_CARD_COLOR_CSS.rose,
    );
    expect(worksetCard()?.getAttribute("data-card-color")).toBeNull();

    const swatch = container.querySelector(
      '[data-card-kind="workset"] [data-testid="timeline-split-month-color"]',
    );
    act(() => {
      swatch?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const sky = container.querySelector(
      '[data-testid="timeline-split-month-color-option"][data-color="sky"]',
    );
    act(() => {
      sky?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(worksetCard()?.getAttribute("data-card-color")).toBe("sky");
    expect(worksetCard()?.style.getPropertyValue("--split-month-card-dot")).toBe(
      BLOCK_CARD_COLOR_CSS.sky,
    );
    expect(
      worksetCard()?.querySelector('[data-testid="timeline-split-month-dot"]'),
    ).not.toBeNull();
    expect(subscribeCard()?.getAttribute("data-card-color")).toBe("rose");
    expect(JSON.parse(window.localStorage.getItem(TIMELINE_BLOCK_CARD_COLORS_STORAGE_KEY) ?? "{}")).toEqual({
      "workset:ws-a": { kind: "preset", id: "sky" },
      "subscribe:Alice/Work": { kind: "preset", id: "rose" },
    });
  });

  it("applies a persisted custom hex to dots and clears back to the theme accent", async () => {
    await ensureZhHantLocale();
    window.localStorage.setItem(
      TIMELINE_BLOCK_CARD_COLORS_STORAGE_KEY,
      JSON.stringify({ "workset:ws-a": { kind: "hex", value: "#C45C3E" } }),
    );
    const { container } = renderGrid({ cards: sampleCards });
    const worksetCard = () =>
      container.querySelector('[data-card-kind="workset"][data-testid="timeline-month-card"]');
    expect(worksetCard()?.getAttribute("data-card-color")).toBe("#c45c3e");
    expect(worksetCard()?.style.getPropertyValue("--split-month-card-dot")).toBe("#c45c3e");
    expect(worksetCard()?.style.getPropertyValue("--split-month-card-accent")).toBe("#c45c3e");
    expect(
      worksetCard()?.querySelector('[data-testid="timeline-split-month-dot"]'),
    ).not.toBeNull();

    const swatch = container.querySelector(
      '[data-card-kind="workset"] [data-testid="timeline-split-month-color"]',
    );
    act(() => {
      swatch?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const reset = container.querySelector(
      '[data-testid="timeline-split-month-color-option"][data-color="default"]',
    );
    act(() => {
      reset?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(worksetCard()?.getAttribute("data-card-color")).toBeNull();
    expect(worksetCard()?.style.getPropertyValue("--split-month-card-dot")).toBe("");
    expect(worksetCard()?.style.getPropertyValue("--split-month-card-accent")).toBe("");
    expect(JSON.parse(window.localStorage.getItem(TIMELINE_BLOCK_CARD_COLORS_STORAGE_KEY) ?? "{}")).toEqual(
      {},
    );
  });

  it("stores a native color-picker hex on the card and paints its dots", async () => {
    await ensureZhHantLocale();
    const { container } = renderGrid({ cards: sampleCards });
    const worksetCard = () =>
      container.querySelector('[data-card-kind="workset"][data-testid="timeline-month-card"]');
    const swatch = container.querySelector(
      '[data-card-kind="workset"] [data-testid="timeline-split-month-color"]',
    );
    act(() => {
      swatch?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const picker = container.querySelector(
      '[data-testid="timeline-split-month-color-custom"]',
    );
    expect(picker).not.toBeNull();
    act(() => {
      if (!(picker instanceof HTMLInputElement)) return;
      picker.value = "#336699";
      picker.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(worksetCard()?.getAttribute("data-card-color")).toBe("#336699");
    expect(worksetCard()?.style.getPropertyValue("--split-month-card-dot")).toBe("#336699");
    expect(
      worksetCard()?.querySelector('[data-testid="timeline-split-month-dot"]'),
    ).not.toBeNull();
    expect(JSON.parse(window.localStorage.getItem(TIMELINE_BLOCK_CARD_COLORS_STORAGE_KEY) ?? "{}")).toEqual({
      "workset:ws-a": { kind: "hex", value: "#336699" },
    });
  });
});
