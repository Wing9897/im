import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchLatestByChannels } from "../../../api/channels";
import { makeMessage } from "../../../test/messageFixtures";
import { useWallData } from "./useWallData";

vi.mock("../../../api/channels", () => ({
  fetchLatestByChannels: vi.fn(),
}));

vi.mock("../../../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => ({ lastMessagesUpdate: null }),
}));

const mockedFetchLatest = vi.mocked(fetchLatestByChannels);

afterEach(() => {
  mockedFetchLatest.mockReset();
  localStorage.clear();
});

describe("useWallData", () => {
  it("discards an older bootstrap response after channel selection changes", async () => {
    const pending = new Map<
      string,
      (payload: Record<string, ReturnType<typeof makeMessage>[]>) => void
    >();
    mockedFetchLatest.mockImplementation(
      (channelIds) =>
        new Promise((resolve) => {
          pending.set(channelIds.join(","), resolve);
        }),
    );

    let wall: ReturnType<typeof useWallData> | null = null;
    function Harness() {
      // Catalog not ready yet — prune must not wipe in-flight selection changes.
      wall = useWallData([], undefined, false);
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    act(() => wall!.setSelectedChannelIds(["telegram:old"]));
    await act(async () => Promise.resolve());
    act(() => wall!.setSelectedChannelIds(["telegram:new"]));
    await act(async () => Promise.resolve());

    await act(async () => {
      pending.get("telegram:new")?.({
        "telegram:new": [makeMessage({ id: "new-message", platformId: "new" })],
      });
      await Promise.resolve();
    });
    expect(wall!.slots["telegram:new"].queue[0].id).toBe("new-message");

    await act(async () => {
      pending.get("telegram:old")?.({
        "telegram:old": [makeMessage({ id: "old-message", platformId: "old" })],
      });
      await Promise.resolve();
    });
    expect(wall!.slots["telegram:new"].queue[0].id).toBe("new-message");
    expect(wall!.slots["telegram:old"]).toBeUndefined();

    act(() => root.unmount());
  });

  it("prunes persisted selections that are missing from a ready catalog", async () => {
    localStorage.setItem("im:wall:channels", JSON.stringify(["telegram:gone", "telegram:keep"]));
    mockedFetchLatest.mockResolvedValue({
      "telegram:keep": [makeMessage({ id: "keep-1", platformId: "keep" })],
    });

    let wall: ReturnType<typeof useWallData> | null = null;
    function Harness({ ready }: { ready: boolean }) {
      wall = useWallData(
        [
          {
            id: "telegram:keep",
            platform: "telegram",
            platformId: "keep",
            channelName: "Keep",
            createdAt: "2026-07-12T00:00:00Z",
          },
        ],
        undefined,
        ready,
      );
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Harness ready={false} />);
      await Promise.resolve();
    });
    expect(wall!.selectedChannelIds).toEqual(["telegram:gone", "telegram:keep"]);

    await act(async () => {
      root.render(<Harness ready={true} />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(wall!.selectedChannelIds).toEqual(["telegram:keep"]);
    expect(JSON.parse(localStorage.getItem("im:wall:channels")!)).toEqual(["telegram:keep"]);

    act(() => root.unmount());
  });

  it("retries bootstrap when retryBootstrap is called", async () => {
    mockedFetchLatest
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        "telegram:alpha": [makeMessage({ id: "alpha-1", platformId: "alpha" })],
      });

    let wall: ReturnType<typeof useWallData> | null = null;
    function Harness() {
      wall = useWallData([
        {
          id: "telegram:alpha",
          platform: "telegram",
          platformId: "alpha",
          channelName: "Alpha",
          createdAt: "2026-07-12T00:00:00Z",
        },
      ]);
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    act(() => wall!.setSelectedChannelIds(["telegram:alpha"]));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(wall!.error).toContain("network");

    await act(async () => {
      wall!.retryBootstrap();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(wall!.error).toBeNull();
    expect(wall!.slots["telegram:alpha"].queue[0].id).toBe("alpha-1");

    act(() => root.unmount());
  });

  it("exposes isRefreshing while re-fetching with existing slot data", async () => {
    let resolveRetry: ((value: Record<string, ReturnType<typeof makeMessage>[]>) => void) | null =
      null;
    mockedFetchLatest
      .mockResolvedValueOnce({
        "telegram:alpha": [makeMessage({ id: "alpha-1", platformId: "alpha" })],
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRetry = resolve;
          }),
      );

    let wall: ReturnType<typeof useWallData> | null = null;
    function Harness() {
      wall = useWallData([
        {
          id: "telegram:alpha",
          platform: "telegram",
          platformId: "alpha",
          channelName: "Alpha",
          createdAt: "2026-07-12T00:00:00Z",
        },
      ]);
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    act(() => wall!.setSelectedChannelIds(["telegram:alpha"]));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(wall!.initialLoading).toBe(false);
    expect(wall!.isRefreshing).toBe(false);
    expect(wall!.slots["telegram:alpha"].queue[0].id).toBe("alpha-1");

    act(() => {
      wall!.retryBootstrap();
    });
    await act(async () => Promise.resolve());

    expect(wall!.isRefreshing).toBe(true);
    expect(wall!.initialLoading).toBe(false);
    expect(wall!.slots["telegram:alpha"].queue[0].id).toBe("alpha-1");

    await act(async () => {
      resolveRetry?.({
        "telegram:alpha": [makeMessage({ id: "alpha-2", platformId: "alpha" })],
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(wall!.isRefreshing).toBe(false);
    expect(wall!.slots["telegram:alpha"].queue[0].id).toBe("alpha-2");

    act(() => root.unmount());
  });
});
