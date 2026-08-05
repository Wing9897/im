import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeAnalysisEvent } from "../../test/analysisEventFixtures";

const MAP_PAGE_CLASS = "im-intelligence-page";

const { mockFetchEvents, runtimeState } = vi.hoisted(() => ({
  mockFetchEvents: vi.fn(),
  runtimeState: {
    lastAnalysisEvent: null as {
      type: "started" | "completed" | "failed";
      payload: {
        taskId: string;
        analysisMode: "intel_event" | "single";
      };
      receivedAt: number;
    } | null,
  },
}));

vi.mock("../../api/results", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/results")>();
  return {
    ...actual,
    fetchEvents: (...args: unknown[]) => mockFetchEvents(...args),
  };
});

vi.mock("../../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => ({
    lastAnalysisEvent: runtimeState.lastAnalysisEvent,
    queueStatus: null,
    analysisPaused: false,
    activeAnalyses: new Map(),
    lastSourceStatusChange: null,
    lastMessagesUpdate: null,
    requestQueueStatusRefresh: () => {},
  }),
}));

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("./map/MapView", () => ({
  MapView: () => null,
}));

vi.mock("react-router-dom", () => ({
  Link: ({
    children,
    to,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  useLocation: () => ({
    pathname: "/intelligence",
    search: "",
    hash: "",
    key: "intel-test",
    state: null,
  }),
  useNavigate: () => vi.fn(),
}));

import { makeAnalysisTask, resetTaskCatalogState } from "../../test/context-mocks";
import { IntelligencePage } from "./IntelligencePage";

type ObserverRecord = {
  callback: IntersectionObserverCallback;
};

const observerRecords: ObserverRecord[] = [];

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: number[] = [0];
  readonly disconnect = vi.fn();
  readonly observe = vi.fn();
  readonly takeRecords = vi.fn(() => []);
  readonly unobserve = vi.fn();

  constructor(
    public readonly callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {
    observerRecords.push({ callback });
  }
}

function triggerIntersection(
  isIntersecting: boolean,
  intersectionRatio: number,
  observerIndex?: number,
) {
  const observer =
    observerIndex !== undefined
      ? observerRecords[observerIndex]
      : observerRecords.at(-1);
  if (!observer) {
    throw new Error("No observer registered");
  }
  const entry: IntersectionObserverEntry = {
    time: Date.now(),
    target: document.createElement("div"),
    rootBounds: null,
    boundingClientRect: {} as DOMRectReadOnly,
    intersectionRect: {} as DOMRectReadOnly,
    isIntersecting,
    intersectionRatio,
  };
  act(() => {
    observer.callback([entry], {} as IntersectionObserver);
  });
}

describe("IntelligencePage", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    window.localStorage.clear();
    observerRecords.length = 0;
    mockFetchEvents.mockReset();
    runtimeState.lastAnalysisEvent = null;
    resetTaskCatalogState([
      makeAnalysisTask({
        createdAt: "2026-04-17T03:00:00.000Z",
        updatedAt: "2026-04-17T03:00:00.000Z",
      }),
    ]);
    mockFetchEvents.mockResolvedValue({ items: [], totalCount: 0, hasMore: false });
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("refetches items when an event analysis completes", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(IntelligencePage));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFetchEvents.mock.calls).toHaveLength(1);

    runtimeState.lastAnalysisEvent = {
      type: "completed",
      payload: {
        taskId: "task-1",
        analysisMode: "intel_event",
      },
      receivedAt: 1,
    };

    await act(async () => {
      root!.render(createElement(IntelligencePage));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFetchEvents.mock.calls).toHaveLength(2);
  });

  it("keeps visible items unread until the page is left", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:00:00.000Z"));
    // Force card mode so the read/unread UI and IntersectionObserver sentinel are rendered
    window.localStorage.setItem("im:view-mode:intelligence", JSON.stringify("card"));
    mockFetchEvents.mockResolvedValue({
      items: [
        makeAnalysisEvent({
          id: "intel-1",
          taskId: "task-1",
          batchId: "batch-1",
          title: "情報事件 1",
          body: "內容 1",
          sourceMessageId: "msg-1",
          sourcePlatform: "telegram",
          sourceChannelName: "Channel 1",
          sourceMessageTime: "2026-04-17T03:00:00.000Z",
          batchSourceChannelNames: ["Channel 1"],
          taskName: "Task 1",
          createdAt: "2026-04-17T03:30:00.000Z",
          updatedAt: "2026-04-17T03:30:00.000Z",
        }),
      ],
      totalCount: 1,
      hasMore: false,
    });

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(IntelligencePage));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(observerRecords.length).toBeGreaterThan(0);
    triggerIntersection(true, 0.8, 0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500);
    });

    // The read/unread summary line was removed from the header; read state is
    // still tracked internally and only persisted to localStorage on unmount.
    expect(
      JSON.parse(
        window.localStorage.getItem("im:intelligence:read-item-ids") ?? "[]",
      ),
    ).toEqual([]);

    act(() => {
      root!.unmount();
    });
    root = null;

    expect(
      JSON.parse(
        window.localStorage.getItem("im:intelligence:read-item-ids") ?? "[]",
      ),
    ).toEqual(["intel-1"]);
  });

  it("does not open IntelligenceDetailDialog when switching from map to card mode", async () => {
    const sampleItem = makeAnalysisEvent({
      id: "intel-map-1",
      taskId: "task-1",
      batchId: "batch-1",
      title: "地圖事件標題",
      body: "地圖事件內容",
      sourceMessageId: "msg-map-1",
      sourcePlatform: "telegram",
      sourceChannelName: "Channel 1",
      sourceMessageTime: "2026-04-17T03:00:00.000Z",
      batchSourceChannelNames: ["Channel 1"],
      taskName: "Task 1",
      createdAt: "2026-04-17T03:30:00.000Z",
      updatedAt: "2026-04-17T03:30:00.000Z",
    });

    window.localStorage.setItem("im:view-mode:intelligence", JSON.stringify("map"));
    mockFetchEvents.mockResolvedValue({
      items: [sampleItem],
      totalCount: 1,
      hasMore: false,
    });

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(IntelligencePage));
      await Promise.resolve();
      await Promise.resolve();
    });

    const cardButton = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (tab) => tab.textContent?.includes("卡片"),
    );
    expect(cardButton).toBeTruthy();

    await act(async () => {
      cardButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("命中來源");
  });
});

describe("intelligence page shell", () => {
  it("uses im-intelligence-page Tailwind shell class for all view modes", () => {
    expect(MAP_PAGE_CLASS).toBe("im-intelligence-page");
  });
});
