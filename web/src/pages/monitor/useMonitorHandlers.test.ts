import { act, createElement, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MonitorViewMode } from "../../domain/monitor/monitorViewMode";
import type { MessageFilters } from "../../types";
import { useMonitorHandlers } from "./useMonitorHandlers";
import { makeMessage } from "../../test/messageFixtures";

vi.mock("../../hooks/useInfiniteScroll", () => ({
  useInfiniteScroll: vi.fn(),
}));

const mockLoadMoreMessages = vi.hoisted(() => vi.fn());

type HandlersResult = ReturnType<typeof useMonitorHandlers>;

interface HarnessSnapshot {
  handlers: HandlersResult;
  filters: MessageFilters;
  viewMode: MonitorViewMode;
  loadMoreMessages: typeof mockLoadMoreMessages;
}

function MonitorHandlersHarness({
  messageCount = 5,
  initialViewMode = "card",
  initialFilters = {},
  onReady,
}: {
  messageCount?: number;
  initialViewMode?: MonitorViewMode;
  initialFilters?: MessageFilters;
  onReady: (snapshot: HarnessSnapshot) => void;
}) {
  const messages = useMemo(
    () =>
      Array.from({ length: messageCount }, (_, index) =>
        makeMessage({ id: `msg-${index}` }),
      ),
    [messageCount],
  );
  const [filters, setFilters] = useState<MessageFilters>(initialFilters);
  const [viewMode] = useState<MonitorViewMode>(initialViewMode);

  const handlers = useMonitorHandlers({
    messages,
    filters,
    setFilters,
    viewMode,
    primaryFetchActive: false,
    hasMore: true,
    loadMoreMessages: mockLoadMoreMessages,
  });

  onReady({
    handlers,
    filters,
    viewMode,
    loadMoreMessages: mockLoadMoreMessages,
  });
  return null;
}

describe("useMonitorHandlers", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: HarnessSnapshot | null = null;

  beforeEach(() => {
    latest = null;
    mockLoadMoreMessages.mockReset();
    mockLoadMoreMessages.mockResolvedValue(undefined);
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

  async function renderHarness(
    props: Partial<Parameters<typeof MonitorHandlersHarness>[0]> = {},
  ) {
    await act(async () => {
      root.render(
        createElement(MonitorHandlersHarness, {
          onReady: (snapshot) => {
            latest = snapshot;
          },
          ...props,
        }),
      );
      await Promise.resolve();
    });
  }

  it("reports active filters and clears them via resetFilters", async () => {
    await renderHarness({
      initialFilters: { search: "keyword" },
    });

    expect(latest!.handlers.hasActiveFilters).toBe(true);

    act(() => {
      latest!.handlers.resetFilters();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(latest!.filters).toEqual({});
    expect(latest!.handlers.hasActiveFilters).toBe(false);
  });

  it("loads another page in card mode the same way as list mode", async () => {
    await renderHarness({ initialViewMode: "card" });

    await act(async () => {
      await latest!.handlers.handleLoadMoreAction();
    });

    expect(latest!.loadMoreMessages).toHaveBeenCalledTimes(1);
  });

  it("loads another page in list mode", async () => {
    await renderHarness({ initialViewMode: "list" });

    await act(async () => {
      await latest!.handlers.handleLoadMoreAction();
    });

    expect(latest!.loadMoreMessages).toHaveBeenCalledTimes(1);
  });
});
