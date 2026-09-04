import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { vi } from "vitest";
import { wrapWithI18n } from "../../../test/i18nHarness";
import { EventListPanel } from "./EventListPanel";
import { makeTimelineItem } from "../../../test/analysisEventFixtures";
import type { TimelineItem } from "../../../types/timelineItem";
import type { TimelinePageContextValue } from "../TimelinePageContext";
import { TimelinePageProvider } from "../TimelinePageContext";

export function makeEvent(id: string, title: string, body = "") {
  return makeTimelineItem({
    id,
    title,
    body,
    startTime: "2026-07-14T00:00:00.000Z",
    endTime: "2026-07-15T00:00:00.000Z",
  });
}

export function makeContext(
  overrides: Partial<TimelinePageContextValue> = {},
): TimelinePageContextValue {
  return {
    selectedEvent: null,
    onSelectEvent: vi.fn(),
    editStartTime: "",
    editEndTime: "",
    setEditStartTime: vi.fn(),
    setEditEndTime: vi.fn(),
    onSaveTimeOverride: vi.fn(),
    onResetTimeOverride: vi.fn(),
    onSetEventStatus: vi.fn(),
    eventStatuses: {},
    showDismissed: true,
    showOngoing: true,
    showEnding: true,
    monthDatesRevealed: false,
    taskSpans: [],
    selectedGanttTaskId: null,
    onSelectGanttTask: vi.fn(),
    spansInitialLoading: false,
    spansIsRefreshing: false,
    spansError: null,
    onRetrySpans: vi.fn(),
    selectedGanttSpan: null,
    onCloseGanttPanel: vi.fn(),
    ganttColumns: [],
    timelineEvents: [],
    timelineEventsInitialLoading: false,
    timelineEventsIsRefreshing: false,
    timelineEventsError: null,
    onRetryTimelineEvents: vi.fn(),
    ...overrides,
  };
}

export function renderPanel(props: {
  rangeEvents: TimelineItem[];
  focusedDay?: Date | null;
  outOfView?: boolean;
  onSelectEvent?: (event: TimelineItem | null) => void;
  context?: Partial<TimelinePageContextValue>;
}) {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(
      wrapWithI18n(
        createElement(TimelinePageProvider, {
          value: makeContext(props.context),
          children: createElement(EventListPanel, {
            rangeEvents: props.rangeEvents,
            focusedDay: props.focusedDay ?? null,
            outOfView: props.outOfView,
            onSelectEvent: props.onSelectEvent ?? (() => {}),
          }),
        }),
      ),
    );
  });
  return { container, root };
}
