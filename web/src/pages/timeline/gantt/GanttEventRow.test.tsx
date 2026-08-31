import { describe, it, expect, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";

import { makeEvent } from "../../../test/timelineTestHelpers";
import { computeEventBarPosition } from "./ganttEventPositioning";
import { ganttGridTemplateColumns } from "./ganttGridLayout";
import type { GanttEventRowModel } from "../../../domain/gantt/groupRecurringGanttRows";
import { GanttEventRow } from "./GanttEventRow";

const rangeStart = new Date(2025, 0, 15);
const columnCount = 24;

function isoAt(hours: number, minutes = 0): string {
  return new Date(2025, 0, 15, hours, minutes).toISOString();
}

function expectedGridColumn(startTime: string, endTime: string | null): string {
  const pos = computeEventBarPosition(
    new Date(startTime),
    endTime ? new Date(endTime) : null,
    "day",
    rangeStart,
    columnCount,
  );
  return `${pos.startColumn} / ${pos.endColumn + 1}`;
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
      createElement(GanttEventRow, {
        row,
        timeScale: "day",
        rangeStart,
        columnCount,
        needsScroll: false,
        gridTemplateColumns: ganttGridTemplateColumns(columnCount, false),
        todayColumnIndex: null,
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

describe("GanttEventRow discrete scale", () => {
  it("does not show trim handles or editable drag on the five scale pills", () => {
    const { container, eventId } = { ...renderRow(makeRow().row), eventId: "ue-1" };
    expect(container.querySelector(`[data-testid="gantt-overview-handle-start-${eventId}"]`)).toBeNull();
    expect(container.querySelector(`[data-testid="gantt-overview-handle-end-${eventId}"]`)).toBeNull();
    expect(
      container.querySelector(`[data-testid="event-bar-${eventId}"]`)?.getAttribute("data-gantt-editable"),
    ).toBeNull();
  });

  it("click on a bar still selects", () => {
    const { row, eventId } = makeRow();
    const { container, onSelect } = renderRow(row);
    const bar = container.querySelector(`[data-testid="event-bar-${eventId}"]`) as HTMLElement;
    expect(bar.style.gridColumn).toBe(expectedGridColumn(isoAt(9), isoAt(11)));
    act(() => {
      bar.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
