import { createElement, act, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { vi } from "vitest";
import {
  buildCalendarDays as buildCalendarDaysFromDomain,
  buildWeekDays as buildWeekDaysFromDomain,
} from "../../../domain/timeline/dateUtils";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";

const { mockUseErrorToast } = vi.hoisted(() => ({
  mockUseErrorToast: vi.fn(),
}));

vi.mock("../../../hooks/useMonthWeather", () => ({
  weatherIcon: () => "☀️",
}));

vi.mock("../../../hooks/useErrorToast", () => ({
  useErrorToast: mockUseErrorToast,
}));

const { TimelineCalendarView } = await import("./TimelineCalendarView");

export type TimelineCalendarViewProps = Parameters<typeof TimelineCalendarView>[0];

export { mockUseErrorToast };

/**
 * Local wrappers so test files receive real functions.
 * Re-exporting the dateUtils bindings from this module (vi.mock + top-level await)
 * leaves them undefined at the import site.
 */
export function buildCalendarDays(month: Date): Date[] {
  return buildCalendarDaysFromDomain(month);
}

export function buildWeekDays(cursor: Date): Date[] {
  return buildWeekDaysFromDomain(cursor);
}

/** Shared prop factory for TimelineCalendarView tests (component imported after vi.mock). */
export function makeTimelineCalendarViewProps<P>(overrides: Partial<P> = {}): P {
  const timeCursor = new Date(2025, 0, 15); // January 15, 2025
  const monthCursor = new Date(2025, 0, 1); // January 2025
  const monthDays = buildCalendarDays(monthCursor);
  const weekDays = buildWeekDays(timeCursor);

  return {
    timeScale: "month",
    rangeStart: new Date(2025, 0, 13), // Monday of the week
    rangeEvents: [],
    weekDays,
    timeCursor,
    monthCursor,
    monthDays,
    monthEvents: [],
    focusedDay: null,
    eventStatuses: {},
    weatherByDate: {
      "2025-01-15": { code: 0, high: 25, low: 18 },
    },
    holidaysByDate: {},
    onSelectEvent: vi.fn(),
    onFocusDay: vi.fn(),
    ...overrides,
  } as P;
}

export function makeProps(
  overrides: Partial<TimelineCalendarViewProps> = {},
): TimelineCalendarViewProps {
  return makeTimelineCalendarViewProps<TimelineCalendarViewProps>(overrides);
}

export function renderTimelineCalendarView<P extends object>(
  Component: ComponentType<P>,
  props: P,
) {
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(wrapWithI18n(createElement(Component, props)));
  });
  return container;
}

export function render(props: TimelineCalendarViewProps) {
  return renderTimelineCalendarView(TimelineCalendarView, props);
}

/** Native pointerenter/leave on the 篩選 eye. */
export function fireMonthRevealPointer(el: Element, phase: "enter" | "leave") {
  const type = phase === "enter" ? "pointerenter" : "pointerleave";
  act(() => {
    el.dispatchEvent(new MouseEvent(type, { bubbles: false, relatedTarget: document.body }));
  });
}

export async function prepareTimelineCalendarViewTests(
  mockUseErrorToast: { mockClear: () => void },
): Promise<void> {
  mockUseErrorToast.mockClear();
  await ensureZhHantLocale();
}
