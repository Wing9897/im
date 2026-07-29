/**
 * TimelineSidebar ownership label: project-tagged user_events use task name.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";
import { USER_EVENTS_FILTER_ID } from "../../../domain/timeline/userEvents";
import type { TimelineItem } from "../../../types";
import {
  TimelinePageProvider,
  type TimelinePageContextValue,
} from "../TimelinePageContext";
import { TimelineSidebar } from "./TimelineSidebar";

function makeUserEvent(overrides: Partial<TimelineItem> = {}): TimelineItem {
  return {
    id: "ue-1",
    taskId: USER_EVENTS_FILTER_ID,
    version: 1,
    batchId: "",
    title: "會議",
    body: "",
    startTime: "2026-07-22T09:00:00Z",
    endTime: null,
    location: null,
    latitude: null,
    longitude: null,
    participants: [],
    sourceMessageId: null,
    sourcePlatform: null,
    sourceChannelName: null,
    sourceMessageTime: null,
    analysisTimeRange: null,
    batchSourceChannelNames: [],
    taskName: "用戶或助手",
    createdAt: "2026-07-21T00:00:00Z",
    updatedAt: "2026-07-21T00:00:00Z",
    source: "user",
    origin: "assistant",
    ...overrides,
  };
}

function makeContext(selectedEvent: TimelineItem | null): TimelinePageContextValue {
  return {
    selectedEvent,
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
  };
}

describe("TimelineSidebar ownership label", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function renderSidebar(selectedEvent: TimelineItem | null) {
    act(() => {
      root.render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(TimelinePageProvider, {
            value: makeContext(selectedEvent),
            children: createElement(TimelineSidebar, {
              rangeEvents: [],
              allRangeEvents: [],
              hasDayFocus: false,
            }),
          }),
        ),
      );
    });
  }

  it("labels unassigned user events as 用戶或助手 source", () => {
    renderSidebar(makeUserEvent());
    expect(container.textContent).toContain("來源：用戶或助手");
    expect(container.textContent).not.toContain("任務：");
  });

  it("labels project-owned user events with the project task name", () => {
    renderSidebar(
      makeUserEvent({
        taskId: "proj-1",
        taskName: "專案 Alpha",
        origin: "project",
      }),
    );
    expect(container.textContent).toContain("任務：專案 Alpha");
    expect(container.textContent).not.toContain("來源：用戶或助手");
  });
});
