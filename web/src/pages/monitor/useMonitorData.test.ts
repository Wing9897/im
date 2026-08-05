import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockListSources, mockListChannelsWithSources, mockQueryMessagesPage, runtimeState } = vi.hoisted(() => ({
  mockListSources: vi.fn(),
  mockListChannelsWithSources: vi.fn(),
  mockQueryMessagesPage: vi.fn(),
  runtimeState: {
    lastMessagesUpdate: null as {
      payload: { messages: import("../../types").Message[] };
      receivedAt: number;
    } | null,
  },
}));

vi.mock("../../api/sources", () => ({
  listSources: (...args: unknown[]) => mockListSources(...args),
}));

vi.mock("../../api/messages", () => ({
  queryMessagesPage: (...args: unknown[]) => mockQueryMessagesPage(...args),
}));

vi.mock("../../api/channels", () => ({
  listChannelsWithSources: (...args: unknown[]) => mockListChannelsWithSources(...args),
}));

vi.mock("../../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => runtimeState,
}));

vi.mock("../../utils/errorReporter", () => ({
  captureError: vi.fn(),
}));

import { useMonitorData } from "./useMonitorData";
import { makeMessage } from "../../test/messageFixtures";

let latest: ReturnType<typeof useMonitorData> | null = null;

function Harness() {
  latest = useMonitorData();
  return null;
}

describe("useMonitorData", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    latest = null;
    localStorage.clear();
    runtimeState.lastMessagesUpdate = null;
    mockListSources.mockReset();
    mockListChannelsWithSources.mockReset();
    mockQueryMessagesPage.mockReset();
    mockListSources.mockResolvedValue([]);
    mockListChannelsWithSources.mockResolvedValue([]);
    mockQueryMessagesPage.mockResolvedValue({
      messages: [makeMessage({ id: "msg-1" })],
      nextCursor: { timestamp: "2024-06-01T12:00:00Z", id: "msg-1" },
      hasMore: true,
      totalCount: 2,
    });
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

  async function renderHook() {
    await act(async () => {
      root.render(createElement(Harness));
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("loads the first messages page on mount", async () => {
    await renderHook();

    expect(mockQueryMessagesPage).toHaveBeenCalled();
    expect(latest!.messages).toHaveLength(1);
    expect(latest!.hasMore).toBe(true);
    expect(latest!.totalCount).toBe(2);
  });

  it("loads channels and stats count in wall mode without full message stream", async () => {
    localStorage.setItem("im:view-mode:monitor", JSON.stringify("wall"));
    mockQueryMessagesPage.mockResolvedValue({
      messages: [],
      totalCount: 42,
      hasMore: true,
      nextCursor: null,
    });
    await renderHook();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockListChannelsWithSources).toHaveBeenCalled();
    expect(mockListSources).toHaveBeenCalled();
    expect(mockQueryMessagesPage).toHaveBeenCalled();
    expect(latest!.viewMode).toBe("wall");
    expect(latest!.totalCount).toBe(42);
    expect(latest!.messages).toHaveLength(0);
  });

  it("exposes source or channel metadata loading failures", async () => {
    mockListChannelsWithSources.mockRejectedValue(new Error("channels unavailable"));
    await renderHook();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(latest!.metadataError).toContain("無法載入帳號或頻道篩選資料");
  });

  it("retries metadata loading after retryMetadataLoad", async () => {
    let shouldFail = true;
    mockListChannelsWithSources.mockImplementation(() => {
      if (shouldFail) {
        return Promise.reject(new Error("channels unavailable"));
      }
      return Promise.resolve([
        {
          id: "telegram:alpha",
          platform: "telegram",
          platformId: "alpha",
          channelName: "Alpha",
          createdAt: "2026-07-12T00:00:00Z",
        },
      ]);
    });

    await renderHook();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(latest!.metadataError).toContain("無法載入");

    shouldFail = false;
    await act(async () => {
      latest!.retryMetadataLoad();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest!.metadataError).toBeNull();
    expect(latest!.channels).toHaveLength(1);
  });

  it("appends the next page when loadMoreMessages runs", async () => {
    mockQueryMessagesPage
      .mockResolvedValueOnce({
        messages: [makeMessage({ id: "msg-1" })],
        nextCursor: { timestamp: "2024-06-01T12:00:00Z", id: "msg-1" },
        hasMore: true,
        totalCount: 2,
      })
      .mockResolvedValueOnce({
        messages: [makeMessage({ id: "msg-2" })],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });

    await renderHook();

    await act(async () => {
      await latest!.loadMoreMessages();
    });

    expect(latest!.messages.map((message) => message.id)).toEqual(["msg-1", "msg-2"]);
    expect(latest!.hasMore).toBe(false);
    expect(latest!.totalCount).toBe(2);
    expect(mockQueryMessagesPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeTotal: false }),
    );
  });

  it("prepends novel SSE messages that match filters", async () => {
    await renderHook();

    runtimeState.lastMessagesUpdate = {
      payload: {
        messages: [makeMessage({ id: "live-1", content: "live update" })],
      },
      receivedAt: Date.now(),
    };

    await act(async () => {
      root.render(createElement(Harness));
      await Promise.resolve();
    });

    expect(latest!.messages[0]?.id).toBe("live-1");
    expect(latest!.totalCount).toBe(3);
  });

  it("keeps cached messages visible while a filter refresh is in flight", async () => {
    let resolveRefresh: ((value: unknown) => void) | null = null;
    mockQueryMessagesPage
      .mockResolvedValueOnce({
        messages: [makeMessage({ id: "msg-1" })],
        nextCursor: null,
        hasMore: false,
        totalCount: 1,
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          }),
      );

    await renderHook();
    expect(latest!.initialLoading).toBe(false);
    expect(latest!.messages).toHaveLength(1);

    await act(async () => {
      latest!.setFilters({ keyword: "refresh" });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest!.isRefreshing).toBe(true);
    expect(latest!.initialLoading).toBe(false);
    expect(latest!.messages).toHaveLength(1);
    expect(latest!.messages[0]?.id).toBe("msg-1");

    await act(async () => {
      resolveRefresh?.({
        messages: [makeMessage({ id: "msg-2" })],
        nextCursor: null,
        hasMore: false,
        totalCount: 1,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest!.isRefreshing).toBe(false);
    expect(latest!.messages[0]?.id).toBe("msg-2");
  });

  it("rebases a pending refresh over matching SSE arrivals", async () => {
    let resolveRefresh: ((value: unknown) => void) | null = null;
    mockQueryMessagesPage
      .mockResolvedValueOnce({
        messages: [makeMessage({ id: "msg-1" })],
        nextCursor: null,
        hasMore: false,
        totalCount: 1,
      })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));

    await renderHook();
    await act(async () => {
      latest!.setFilters({ keyword: "refresh" });
      await Promise.resolve();
    });

    runtimeState.lastMessagesUpdate = {
      payload: { messages: [makeMessage({ id: "live-refresh", content: "refresh live" })] },
      receivedAt: Date.now(),
    };
    await act(async () => {
      root.render(createElement(Harness));
      await Promise.resolve();
    });

    await act(async () => {
      resolveRefresh?.({
        messages: [makeMessage({ id: "msg-2", content: "refresh page" })],
        nextCursor: null,
        hasMore: false,
        totalCount: 1,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest!.messages.map((message) => message.id)).toEqual(["live-refresh", "msg-2"]);
    expect(latest!.totalCount).toBe(2);
  });

  it("preserves SSE arrivals while load more is pending", async () => {
    let resolveLoadMore: ((value: unknown) => void) | null = null;
    mockQueryMessagesPage
      .mockResolvedValueOnce({
        messages: [makeMessage({ id: "msg-1" })],
        nextCursor: { timestamp: "2024-06-01T12:00:00Z", id: "msg-1" },
        hasMore: true,
        totalCount: 2,
      })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveLoadMore = resolve; }));

    await renderHook();
    let loadMoreFlight: Promise<void>;
    act(() => {
      loadMoreFlight = latest!.loadMoreMessages();
    });

    runtimeState.lastMessagesUpdate = {
      payload: { messages: [makeMessage({ id: "live-more", content: "live while paging" })] },
      receivedAt: Date.now(),
    };
    await act(async () => {
      root.render(createElement(Harness));
      await Promise.resolve();
    });

    await act(async () => {
      resolveLoadMore?.({
        messages: [makeMessage({ id: "msg-2" })],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      await loadMoreFlight!;
    });

    expect(latest!.messages.map((message) => message.id)).toEqual(["live-more", "msg-1", "msg-2"]);
    expect(latest!.totalCount).toBe(3);
  });
});
