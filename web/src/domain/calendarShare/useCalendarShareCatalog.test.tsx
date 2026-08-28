import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/calendarShare", async () =>
  (await import("../../test/calendarShareApiMock")).calendarShareApiModuleMock());

import { calendarShareApiMocks, resetCalendarShareApiMocks } from "../../test/calendarShareApiMock";
import {
  applyCalendarShareCatalogItems,
  invalidateCalendarShareCatalog,
  refreshCalendarShareCatalog,
  resetCalendarShareCatalogForTests,
  useCalendarShareCatalog,
} from "./useCalendarShareCatalog";

function Harness({ refOut }: { refOut: { current: ReturnType<typeof useCalendarShareCatalog> | null } }) {
  refOut.current = useCalendarShareCatalog();
  return null;
}

describe("useCalendarShareCatalog", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let resultRef: { current: ReturnType<typeof useCalendarShareCatalog> | null };

  beforeEach(() => {
    resetCalendarShareCatalogForTests();
    resetCalendarShareApiMocks();
    calendarShareApiMocks.fetchCalendarShareSession.mockResolvedValue({
      connected: true,
      baseUrl: "http://127.0.0.1:8787",
      handle: "Wing",
      status: "connected",
    });
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockResolvedValue({
      items: [{ handle: "DemoPub", slug: "Open" }],
      ownHandle: "Wing",
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    resultRef = { current: null };
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
    resetCalendarShareCatalogForTests();
  });

  async function renderHook() {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(Harness, { refOut: resultRef }));
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("loads session and subscriptions together and exposes ownHandle from the catalog", async () => {
    await renderHook();
    expect(calendarShareApiMocks.fetchCalendarShareSession).toHaveBeenCalled();
    expect(calendarShareApiMocks.fetchCalendarShareSubscriptions).toHaveBeenCalled();
    expect(resultRef.current?.items).toEqual([{ handle: "DemoPub", slug: "Open" }]);
    expect(resultRef.current?.ownHandle).toBe("Wing");
    expect(resultRef.current?.session?.connected).toBe(true);
  });

  it("applyCalendarShareCatalogItems updates items without fetch", async () => {
    await renderHook();
    expect(calendarShareApiMocks.fetchCalendarShareSubscriptions).toHaveBeenCalledTimes(1);
    act(() => {
      applyCalendarShareCatalogItems([{ handle: "Alice", slug: "Work" }], "Wing");
    });
    expect(resultRef.current?.items).toEqual([{ handle: "Alice", slug: "Work" }]);
    expect(calendarShareApiMocks.fetchCalendarShareSubscriptions).toHaveBeenCalledTimes(1);
  });

  it("shares one fetch across subscribers and refreshes all of them on invalidate", async () => {
    await renderHook();
    expect(calendarShareApiMocks.fetchCalendarShareSubscriptions).toHaveBeenCalledTimes(1);

    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockResolvedValue({
      items: [{ handle: "Alice", slug: "Work" }],
      ownHandle: "Wing",
    });
    await act(async () => {
      invalidateCalendarShareCatalog();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(resultRef.current?.items).toEqual([{ handle: "Alice", slug: "Work" }]);
  });

  it("refresh is a no-op while a request is in flight", async () => {
    let resolveSession: (value: unknown) => void = () => {};
    calendarShareApiMocks.fetchCalendarShareSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );
    const first = refreshCalendarShareCatalog();
    const second = refreshCalendarShareCatalog();
    expect(second).toBe(first);
    resolveSession({
      connected: true,
      baseUrl: "http://127.0.0.1:8787",
      handle: "Wing",
      status: "connected",
    });
    await first;
  });

  it("treats a subscriptions 404 as an empty catalog, not an error", async () => {
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockRejectedValue(new Error("Not found"));
    await renderHook();
    expect(resultRef.current?.items).toEqual([]);
    expect(resultRef.current?.error).toBeNull();
    expect(resultRef.current?.unreachable).toBe(false);
    expect(resultRef.current?.session?.connected).toBe(true);
    expect(resultRef.current?.loading).toBe(false);
  });

  it("marks catalog unreachable on 502 without treating it as logged out", async () => {
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockRejectedValue(
      Object.assign(new Error("Calendar share server unreachable"), { status: 502, name: "ApiRequestError" }),
    );
    await renderHook();
    expect(resultRef.current?.unreachable).toBe(true);
    expect(resultRef.current?.session?.connected).toBe(true);
    expect(resultRef.current?.error).toBeTruthy();
  });

  it("does not flash loading when invalidate refreshes a loaded catalog", async () => {
    await renderHook();
    expect(resultRef.current?.loading).toBe(false);
    let resolveSubs: (value: unknown) => void = () => {};
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockReturnValue(
      new Promise((resolve) => {
        resolveSubs = resolve;
      }),
    );
    act(() => {
      void invalidateCalendarShareCatalog();
    });
    expect(resultRef.current?.loading).toBe(false);
    expect(resultRef.current?.items).toEqual([{ handle: "DemoPub", slug: "Open" }]);
    resolveSubs({ items: [{ handle: "Alice", slug: "Work" }], ownHandle: "Wing" });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(resultRef.current?.items).toEqual([{ handle: "Alice", slug: "Work" }]);
    expect(resultRef.current?.loading).toBe(false);
  });
});
