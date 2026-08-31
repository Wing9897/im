import { describe, it, expect, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";

import { GANTT_DAY_MS } from "../../../domain/gantt/ganttTimeGeometry";
import { makeEvent } from "../../../test/timelineTestHelpers";
import type { GanttEventRowModel } from "../../../domain/gantt/groupRecurringGanttRows";
import { GanttOverviewEventRow } from "./GanttOverviewEventRow";

const rangeStart = new Date(2025, 0, 15);
const overviewWindow = { startMs: rangeStart.getTime(), spanMs: GANTT_DAY_MS };

function isoAt(hours: number, minutes = 0): string {
  return new Date(2025, 0, 15, hours, minutes).toISOString();
}

function makeRow(
  overrides: Parameters<typeof makeEvent>[0] = {},
): { row: GanttEventRowModel; eventId: string } {
  const event = makeEvent({
    id: "ue-1",
    source: "user",
    startTime: isoAt(9),
    endTime: isoAt(11),
    ...overrides,
  });
  return {
    eventId: event.id,
    row: {
      rowId: event.id,
      label: event.title,
      occurrences: [event],
      dismissed: false,
    },
  };
}

function renderRow(
  row: GanttEventRowModel,
  extras: { onSelect?: (event: { id: string }) => void } = {},
) {
  const container = document.createElement("div");
  const onSelect = extras.onSelect ?? vi.fn();
  act(() => {
    createRoot(container).render(
      createElement(GanttOverviewEventRow, {
        row,
        overviewWindow,
        eventStatuses: {},
        isHovered: false,
        onSelect,
        onHoverStart: vi.fn(),
        onHoverEnd: vi.fn(),
      }),
    );
  });
  return { container, onSelect };
}

describe("GanttOverviewEventRow display", () => {
  it("does not show trim handles or editable drag", () => {
    const { container } = renderRow(makeRow().row);
    expect(container.querySelector('[data-testid="gantt-overview-handle-start-ue-1"]')).toBeNull();
    expect(container.querySelector('[data-testid="gantt-overview-handle-end-ue-1"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="event-bar-ue-1"]')?.getAttribute("data-gantt-editable"),
    ).toBeNull();
  });

  it("places the bar by percent and click selects", () => {
    const { row, eventId } = makeRow();
    const { container, onSelect } = renderRow(row);
    const bar = container.querySelector(`[data-testid="event-bar-${eventId}"]`) as HTMLElement;
    expect(bar.style.left).toBe(`${(9 / 24) * 100}%`);
    act(() => {
      bar.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
