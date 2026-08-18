import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UserEvent } from "../../api/userEvents";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";
import type { RecurringSeries } from "../../types/recurring";
import { ScheduleOneOffCard, ScheduleRecurringCard } from "./ScheduleEventCard";

function makeEvent(overrides: Partial<UserEvent> = {}): UserEvent {
  return {
    id: "ue-1",
    title: "晨會",
    body: "",
    startTime: "2026-09-01T09:00:00Z",
    endTime: null,
    location: null,
    origin: "manual",
    isAllDay: false,
    worksetId: "__user__",
    taskId: "",
    source: "user",
    dismissed: false,
    kind: "normal",
    createdAt: "2026-09-01T08:00:00Z",
    updatedAt: "2026-09-01T08:00:00Z",
    ...overrides,
  } as UserEvent;
}

function makeSeries(overrides: Partial<RecurringSeries> = {}): RecurringSeries {
  return {
    id: "rec-1",
    name: "每日站會",
    description: null,
    rrule: "FREQ=DAILY",
    eventStartTime: null,
    eventEndTime: null,
    eventIsAllDay: false,
    eventLocation: null,
    eventDescription: null,
    eventTimezone: null,
    eventExdates: [],
    eventRdates: [],
    icsUid: null,
    icsSource: null,
    isActive: true,
    worksetId: "__user__",
    parentTaskId: null,
    itemId: null,
    createdAt: "2026-09-02T08:00:00Z",
    updatedAt: "2026-09-02T08:00:00Z",
    ...overrides,
  } as RecurringSeries;
}

describe("ScheduleEventCard", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(async () => {
    await ensureZhHantLocale();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
  });

  it("stacks one-off fields and shows N/A for empty location and notes", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        wrapWithI18n(
          createElement(ScheduleOneOffCard, {
            event: makeEvent({ location: null, body: "  " }),
            worksetName: null,
            onEdit: vi.fn(),
            onDelete: vi.fn(),
          }),
        ),
      );
    });

    const fields = container.querySelector('[data-testid="schedule-card-fields"]');
    expect(fields).toBeTruthy();
    expect(fields?.className).toContain("flex-col");
    expect(container.querySelector('[data-testid="schedule-card-when"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="schedule-card-when"] svg')).toBeTruthy();
    expect(container.querySelector('[data-testid="schedule-card-location"]')?.textContent).toContain(
      "地點：N/A",
    );
    expect(container.querySelector('[data-testid="schedule-card-location"] svg')).toBeTruthy();
    expect(container.querySelector('[data-testid="schedule-card-notes"]')?.textContent).toContain(
      "說明：N/A",
    );
    expect(container.querySelector('[data-testid="schedule-card-notes"] svg')).toBeTruthy();
  });

  it("puts a large CalendarDays mark beside the one-off title", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        wrapWithI18n(
          createElement(ScheduleOneOffCard, {
            event: makeEvent({ title: "到期" }),
            worksetName: null,
            onEdit: vi.fn(),
            onDelete: vi.fn(),
          }),
        ),
      );
    });

    const titleIcon = container.querySelector('[data-testid="card-title-icon"]');
    expect(titleIcon).toBeTruthy();
    expect(titleIcon?.getAttribute("width")).toBe("20");
    expect(titleIcon?.classList.contains("lucide-calendar-days")).toBe(true);
    expect(container.querySelector('[data-testid="schedule-card-when"] svg')).toBeTruthy();
  });

  it("keeps filled location and notes on their own rows", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        wrapWithI18n(
          createElement(ScheduleOneOffCard, {
            event: makeEvent({ location: "台北", body: "帶筆電" }),
            worksetName: "一般",
            onEdit: vi.fn(),
            onDelete: vi.fn(),
          }),
        ),
      );
    });

    expect(container.querySelector('[data-testid="schedule-card-location"]')?.textContent).toContain(
      "地點：台北",
    );
    expect(container.querySelector('[data-testid="schedule-card-notes"]')?.textContent).toContain(
      "說明：帶筆電",
    );
    expect(container.querySelector('[data-testid="schedule-card-workset"]')?.textContent).toContain(
      "一般",
    );
  });

  it("puts a large Repeat mark beside the recurring title", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        wrapWithI18n(
          createElement(ScheduleRecurringCard, {
            task: makeSeries(),
            worksetName: null,
            onEdit: vi.fn(),
            onDelete: vi.fn(),
            onToggleActive: vi.fn(async () => undefined),
          }),
        ),
      );
    });

    const titleIcon = container.querySelector('[data-testid="card-title-icon"]');
    expect(titleIcon).toBeTruthy();
    expect(titleIcon?.getAttribute("width")).toBe("20");
    expect(titleIcon?.classList.contains("lucide-repeat")).toBe(true);
    expect(container.querySelector('[data-testid="schedule-card-rrule"] svg')).toBeTruthy();
  });

  it("always shows location and notes on recurring cards", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        wrapWithI18n(
          createElement(ScheduleRecurringCard, {
            task: makeSeries({ eventLocation: "3F", eventDescription: null }),
            worksetName: null,
            onEdit: vi.fn(),
            onDelete: vi.fn(),
            onToggleActive: vi.fn(async () => undefined),
          }),
        ),
      );
    });

    expect(container.querySelector('[data-testid="schedule-card-fields"]')?.className).toContain(
      "flex-col",
    );
    expect(container.querySelector('[data-testid="schedule-card-location"]')?.textContent).toContain(
      "地點：3F",
    );
    expect(container.querySelector('[data-testid="schedule-card-notes"]')?.textContent).toContain(
      "說明：N/A",
    );
  });
});
