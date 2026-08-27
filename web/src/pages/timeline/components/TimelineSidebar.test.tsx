/**
 * TimelineSidebar detail pane: workset + generation provenance (aligned with list cards).
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import type { TimelineItem } from "../../../types";
import {
  makeAnalysisTask,
  resetTaskCatalogState,
  taskCatalogState,
} from "../../../test/context-mocks";
import {
  TimelinePageProvider,
  type TimelinePageContextValue,
} from "../TimelinePageContext";
import { TimelineSidebar } from "./TimelineSidebar";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";

vi.mock("../../../context/TaskCatalogContext", async () =>
  (await import("../../../test/context-mocks")).taskCatalogModuleMock(),
);

function makeUserEvent(overrides: Partial<TimelineItem> = {}): TimelineItem {
  return {
    id: "ue-1",
    taskId: null,
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
    taskName: "一般",
    createdAt: "2026-07-21T00:00:00Z",
    updatedAt: "2026-07-21T00:00:00Z",
    source: "user",
    origin: "assistant",
    worksetId: SYSTEM_WORKSET_ID,
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
  };
}

describe("TimelineSidebar detail provenance", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await ensureZhHantLocale();
    resetTaskCatalogState([]);
    taskCatalogState.worksets = [
      { id: SYSTEM_WORKSET_ID, name: "一般", createdAt: null, updatedAt: null },
      { id: "ws-ops", name: "營運", createdAt: null, updatedAt: null },
    ];
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
        wrapWithI18n(
          createElement(TimelinePageProvider, {
            value: makeContext(selectedEvent),
            children: createElement(TimelineSidebar, {
              rangeEvents: [],
              focusedDay: null,
            }),
          }),
        ),
      );
    });
  }

  it("frosts the detail aside with im-surface-panel and rounded inset chrome", () => {
    renderSidebar(makeUserEvent());
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("im-surface-panel");
    expect(aside?.className).toContain("rounded-xl");
    expect(aside?.className).toContain("p-md");
    expect(aside?.className).not.toContain("pl-lg");
  });

  it("shows workset + assistant provenance for unassigned user events", () => {
    renderSidebar(makeUserEvent());
    expect(
      container.querySelector('[data-testid="timeline-sidebar-workset"]')?.textContent,
    ).toBe("工作集：一般");
    expect(
      container.querySelector('[data-testid="timeline-sidebar-provenance"]')?.textContent,
    ).toBe("助手");
    expect(container.textContent).not.toContain("任務：");
  });

  it("shows agent provenance (not taskName-as-workset) for agent-origin events", () => {
    renderSidebar(
      makeUserEvent({
        taskId: "proj-1",
        taskName: "專案 Alpha",
        origin: "agent",
        worksetId: SYSTEM_WORKSET_ID,
      }),
    );
    expect(
      container.querySelector('[data-testid="timeline-sidebar-workset"]')?.textContent,
    ).toBe("工作集：一般");
    expect(
      container.querySelector('[data-testid="timeline-sidebar-provenance"]')?.textContent,
    ).toBe("代理");
  });

  it("shows task provenance with task name for analysis events", () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "task-ops", name: "Ops Task", worksetId: "ws-ops" }),
    ]);
    taskCatalogState.worksets = [
      { id: SYSTEM_WORKSET_ID, name: "一般", createdAt: null, updatedAt: null },
      { id: "ws-ops", name: "營運", createdAt: null, updatedAt: null },
    ];
    renderSidebar(
      makeUserEvent({
        id: "an-1",
        title: "分析事件",
        source: "analysis",
        origin: undefined,
        taskId: "task-ops",
        taskName: "Ops Task",
        worksetId: "ws-ops",
      }),
    );
    expect(
      container.querySelector('[data-testid="timeline-sidebar-workset"]')?.textContent,
    ).toBe("工作集：營運");
    expect(
      container.querySelector('[data-testid="timeline-sidebar-provenance"]')?.textContent,
    ).toBe("任務：Ops Task");
    const titleStack = container.querySelector(
      '[data-testid="timeline-sidebar-title"] [data-testid="intel-event-avatar-stack"]',
    );
    const intel = container.querySelector(
      '[data-testid="timeline-sidebar-title"] [data-testid="intel-event-mark"]',
    ) as HTMLElement | null;
    const taskOverlay = container.querySelector(
      '[data-testid="timeline-sidebar-title"] [data-testid="intel-event-task-badge"] [data-testid="task-logo-mark"]',
    ) as HTMLElement | null;
    expect(titleStack).not.toBeNull();
    expect(intel?.style.width).toBe("28px");
    expect(taskOverlay?.style.width).toBe("14px");
    expect(intel?.querySelector("svg")?.classList.contains("lucide-radar")).toBe(true);
    expect(taskOverlay?.querySelector("svg")?.classList.contains("lucide-list-checks")).toBe(true);
    const provenance = container.querySelector('[data-testid="timeline-sidebar-provenance"]');
    expect(provenance?.querySelector('[data-testid="intel-event-avatar-stack"]')).toBeNull();
    expect(provenance?.querySelector('[data-testid="intel-event-mark"]')).toBeNull();
    expect(provenance?.querySelector('[data-testid="task-logo-mark"]')).toBeNull();
    expect(provenance?.querySelector("svg")?.getAttribute("width")).toBe("14");
    expect(provenance?.querySelector("svg")?.classList.contains("lucide-list-checks")).toBe(
      true,
    );
  });

  it("shows item provenance and strips remind title prefix when badge shown", () => {
    renderSidebar(
      makeUserEvent({
        id: "item:r",
        title: "提醒 · milk",
        source: "item_remind",
        origin: undefined,
        itemDateKind: "remind",
        taskId: null,
        taskName: null,
        worksetId: SYSTEM_WORKSET_ID,
      }),
    );
    expect(
      container.querySelector('[data-testid="timeline-sidebar-title"]')?.textContent,
    ).toBe("milk");
    expect(
      container.querySelector('[data-testid="timeline-sidebar-remind-badge"]')?.textContent,
    ).toBe("提醒");
    expect(
      container.querySelector('[data-testid="timeline-sidebar-provenance"]')?.textContent,
    ).toBe("物品");
  });

  it("shows the shared schedule emoji beside the detail title", () => {
    renderSidebar(makeUserEvent({ id: "ue-1", title: "生日", emoji: "🎂" }));
    const title = container.querySelector('[data-testid="timeline-sidebar-title"]');
    expect(title?.textContent).toContain("🎂");
    expect(title?.textContent).toContain("生日");
    expect(title?.querySelector('[data-testid="schedule-event-emoji"]')?.textContent).toBe("🎂");
  });

  it("hides dismiss on subscribed calendar events", () => {
    renderSidebar(
      makeUserEvent({
        id: "sub-open",
        title: "Open Office Hours",
        source: "subscribed:DemoPub/Open",
        origin: undefined,
        taskId: null,
        taskName: null,
      }),
    );
    expect(container.querySelector('[data-testid="timeline-sidebar-dismiss"]')).toBeNull();
    expect(container.textContent).not.toContain("從時間軸拿掉");
    expect(
      container.querySelector('[data-testid="timeline-sidebar-provenance"]')?.textContent,
    ).toContain("訂閱：DemoPub/Open");
  });

  it("keeps dismiss on local user events", () => {
    renderSidebar(makeUserEvent());
    expect(container.querySelector('[data-testid="timeline-sidebar-dismiss"]')).not.toBeNull();
    expect(container.textContent).toContain("從時間軸拿掉");
  });
});
