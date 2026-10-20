import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { wrapWithI18n } from "../../../test/i18nHarness";
import { EventListPanel } from "./EventListPanel";
import { makeTimelineItem } from "../../../test/analysisEventFixtures";
import {
  makeTimelinePageContext,
  type TimelinePageContextOverrides,
} from "../../../test/timelinePageContextFixtures";
import type { TimelineItem } from "../../../types/timelineItem";
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
  overrides: TimelinePageContextOverrides = {},
): ReturnType<typeof makeTimelinePageContext> {
  return makeTimelinePageContext({
    showDismissed: true,
    ...overrides,
  });
}

export function renderPanel(props: {
  rangeEvents: TimelineItem[];
  focusedDay?: Date | null;
  outOfView?: boolean;
  onSelectEvent?: (event: TimelineItem | null) => void;
  context?: TimelinePageContextOverrides;
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
