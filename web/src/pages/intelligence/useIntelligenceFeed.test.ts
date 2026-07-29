import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeAnalysisEvent } from "../../test/analysisEventFixtures";
import { INTELLIGENCE_API_PAGE_SIZE, MAP_SYNC_MAX_ITEMS } from "./intelligenceFeedConfig";

const { mockFetchEvents } = vi.hoisted(() => ({
  mockFetchEvents: vi.fn(),
}));

vi.mock("../../api/results", () => ({
  fetchEvents: (...args: unknown[]) => mockFetchEvents(...args),
}));

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => ({
    lastAnalysisEvent: null,
    queueStatus: null,
    analysisPaused: false,
    activeAnalysis: null,
    activeAnalyses: new Map(),
    lastAccountStatusChange: null,
    lastMessagesUpdate: null,
    requestQueueStatusRefresh: () => {},
  }),
}));

vi.mock("../../hooks/useRefreshOnAnalysisEvent", () => ({
  useRefreshOnAnalysisEvent: () => {},
}));

const { useIntelligenceFeed } = await import("./useIntelligenceFeed");

let latest: ReturnType<typeof useIntelligenceFeed> | null = null;

function Harness() {
  latest = useIntelligenceFeed();
  return null;
}

describe("useIntelligenceFeed", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    latest = null;
    localStorage.clear();
    mockFetchEvents.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  async function flushPromises() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("requests the first page with API page size 200 and today time window", async () => {
    localStorage.setItem("im:view-mode:intelligence", JSON.stringify("card"));
    mockFetchEvents.mockResolvedValue({
      items: [makeAnalysisEvent({ id: "1" })],
      totalCount: 1,
      hasMore: false,
    });

    await act(async () => {
      root.render(createElement(Harness));
      await flushPromises();
    });

    expect(mockFetchEvents).toHaveBeenCalled();
    const firstCall = mockFetchEvents.mock.calls[0]?.[0];
    expect(firstCall).toMatchObject({
      limit: INTELLIGENCE_API_PAGE_SIZE,
      offset: 0,
      sort: "event_time",
    });
    expect(firstCall?.startDate).toBeTruthy();
    expect(firstCall?.endDate).toBeTruthy();
  });

  it("fetches the next API page when cached rows are exhausted", async () => {
    localStorage.setItem("im:view-mode:intelligence", JSON.stringify("card"));
    const firstPage = Array.from({ length: 200 }, (_, index) =>
      makeAnalysisEvent({ id: `p1-${index}` }),
    );
    const secondPage = [makeAnalysisEvent({ id: "p2-0" })];

    mockFetchEvents
      .mockResolvedValueOnce({
        items: firstPage,
        totalCount: 201,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: secondPage,
        totalCount: 201,
        hasMore: false,
      });

    await act(async () => {
      root.render(createElement(Harness));
      await flushPromises();
    });

    expect(latest!.allItems.length).toBe(200);

    while (latest!.hasMoreCached) {
      await act(async () => {
        await latest!.loadMoreItems();
      });
    }

    expect(latest!.hasMoreRemote).toBe(true);

    await act(async () => {
      await latest!.loadMoreItems();
      await flushPromises();
    });

    expect(mockFetchEvents).toHaveBeenCalledTimes(2);
    expect(mockFetchEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({
        limit: INTELLIGENCE_API_PAGE_SIZE,
        offset: 200,
        startDate: expect.any(String),
        endDate: expect.any(String),
      }),
    );
    expect(latest!.allItems).toHaveLength(201);
  });

  it("map mode requests has_coords and fills at most a few window pages", async () => {
    localStorage.setItem("im:view-mode:intelligence", JSON.stringify("map"));
    const firstPage = Array.from({ length: 200 }, (_, index) =>
      makeAnalysisEvent({ id: `map-${index}` }),
    );
    const secondPage = [makeAnalysisEvent({ id: "map-200" })];

    mockFetchEvents
      .mockResolvedValueOnce({
        items: firstPage,
        totalCount: 201,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: secondPage,
        totalCount: 201,
        hasMore: false,
      });

    await act(async () => {
      root.render(createElement(Harness));
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    expect(mockFetchEvents.mock.calls[0]?.[0]).toMatchObject({
      hasCoords: true,
      limit: INTELLIGENCE_API_PAGE_SIZE,
      offset: 0,
    });
    expect(mockFetchEvents.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(latest!.allItems.length).toBe(201);
    expect(latest!.mapSyncing).toBe(false);
  });

  it("map soft-cap stops auto-fill; loadMoreMapBatch appends one more page", async () => {
    localStorage.setItem("im:view-mode:intelligence", JSON.stringify("map"));

    mockFetchEvents.mockImplementation(async (params: { offset?: number }) => {
      const offset = params.offset ?? 0;
      const total = 1400;
      if (offset >= total) {
        return { items: [], totalCount: total, hasMore: false };
      }
      const count = Math.min(INTELLIGENCE_API_PAGE_SIZE, total - offset);
      return {
        items: Array.from({ length: count }, (_, index) =>
          makeAnalysisEvent({ id: `cap-${offset + index}` }),
        ),
        totalCount: total,
        hasMore: offset + count < total,
      };
    });

    await act(async () => {
      root.render(createElement(Harness));
    });

    for (let i = 0; i < 40; i++) {
      await flushPromises();
      if (latest && !latest.mapSyncing && latest.allItems.length >= MAP_SYNC_MAX_ITEMS) {
        break;
      }
    }

    expect(latest!.mapSyncing).toBe(false);
    expect(latest!.allItems.length).toBe(MAP_SYNC_MAX_ITEMS);
    expect(latest!.mapSyncAtCap).toBe(true);
    expect(mockFetchEvents).toHaveBeenCalledTimes(MAP_SYNC_MAX_ITEMS / INTELLIGENCE_API_PAGE_SIZE);

    await act(async () => {
      await latest!.loadMoreMapBatch();
      await flushPromises();
      await flushPromises();
    });

    expect(latest!.allItems.length).toBe(MAP_SYNC_MAX_ITEMS + INTELLIGENCE_API_PAGE_SIZE);
    expect(latest!.mapSyncAtCap).toBe(true);
    expect(mockFetchEvents).toHaveBeenCalledTimes(
      MAP_SYNC_MAX_ITEMS / INTELLIGENCE_API_PAGE_SIZE + 1,
    );
  });

  it("list mode omits has_coords on the first page request", async () => {
    localStorage.setItem("im:view-mode:intelligence", JSON.stringify("card"));
    mockFetchEvents.mockResolvedValue({
      items: [makeAnalysisEvent({ id: "1" })],
      totalCount: 1,
      hasMore: false,
    });

    await act(async () => {
      root.render(createElement(Harness));
      await flushPromises();
    });

    expect(mockFetchEvents.mock.calls[0]?.[0]?.hasCoords).toBeUndefined();
  });

  it("queues concurrent remote page fetches so the second page is not dropped", async () => {
    localStorage.setItem("im:view-mode:intelligence", JSON.stringify("card"));
    const firstPage = [makeAnalysisEvent({ id: "1" }), makeAnalysisEvent({ id: "2" })];
    const secondPage = [makeAnalysisEvent({ id: "3" }), makeAnalysisEvent({ id: "4" })];

    let releaseSecondPage: (() => void) | undefined;
    const secondPageGate = new Promise<void>((resolve) => {
      releaseSecondPage = resolve;
    });

    mockFetchEvents
      .mockResolvedValueOnce({
        items: firstPage,
        totalCount: 4,
        hasMore: true,
      })
      .mockImplementationOnce(async () => {
        await secondPageGate;
        return {
          items: secondPage,
          totalCount: 4,
          hasMore: false,
        };
      });

    await act(async () => {
      root.render(createElement(Harness));
      await flushPromises();
    });

    expect(latest!.hasMoreRemote).toBe(true);

    let firstLoad!: Promise<void>;
    let secondLoad!: Promise<void>;
    await act(async () => {
      firstLoad = latest!.loadMoreItems();
      secondLoad = latest!.loadMoreItems();
    });

    releaseSecondPage?.();
    await act(async () => {
      await Promise.all([firstLoad, secondLoad]);
      await flushPromises();
    });

    const remoteOffsets = mockFetchEvents.mock.calls
      .map((call) => call[0]?.offset)
      .filter((offset) => offset > 0);
    expect(remoteOffsets.length).toBeGreaterThanOrEqual(1);
    expect(latest!.allItems).toHaveLength(4);
  });
});
