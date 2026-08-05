import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock the REST API channels module (replaces old Tauri invoke layer mock).
// ---------------------------------------------------------------------------
const { mockListChannelsWithSources } = vi.hoisted(() => ({
  mockListChannelsWithSources: vi.fn(),
}));

vi.mock("../api/channels", () => ({
  listChannelsWithSources: (...args: unknown[]) => mockListChannelsWithSources(...args),
}));

vi.mock("../context/ToastContext", async () =>
  (await import("../test/context-mocks")).toastContextModuleMock());

import { mockShowToast } from "../test/context-mocks";
import { useChannelsWithSources } from "./useChannelsWithSources";
import type { ChannelWithSource } from "../types";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
let latest: ReturnType<typeof useChannelsWithSources> | null = null;

function Harness() {
  latest = useChannelsWithSources();
  return null;
}

function renderHarness() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Harness />);
  });
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

// ---------------------------------------------------------------------------
// Error-path tests
// ---------------------------------------------------------------------------
describe("useChannelsWithSources — error paths", () => {
  beforeEach(() => {
    mockListChannelsWithSources.mockReset();
    mockShowToast.mockReset();
    latest = null;
  });

  afterEach(() => {
    latest = null;
  });

  it("network failure: surfaces error string, clears loading, returns empty array", async () => {
    mockListChannelsWithSources.mockRejectedValueOnce(new Error("connection refused"));

    const { container, root } = renderHarness();
    await flushAsync();

    expect(mockListChannelsWithSources).toHaveBeenCalled();
    expect(latest!.error).toBe("connection refused");
    expect(latest!.initialLoading).toBe(false);
    expect(latest!.channels).toEqual([]);
    // Toast surfaces the error to the user.
    expect(mockShowToast).toHaveBeenCalledWith("connection refused", "error");

    cleanup(root, container);
  });

  it("invalid response (non-Error rejection): coerces to string error message", async () => {
    mockListChannelsWithSources.mockRejectedValueOnce({ kind: "ValidationError", code: 422 });

    const { container, root } = renderHarness();
    await flushAsync();

    expect(latest!.initialLoading).toBe(false);
    // toErrorMessage returns the JSON-stringified or stringified form.
    expect(typeof latest!.error).toBe("string");
    expect(latest!.error).toBeTruthy();
    expect(latest!.channels).toEqual([]);

    cleanup(root, container);
  });

  it("recovery via refresh: a successful refresh after failure clears the error", async () => {
    const sample: ChannelWithSource[] = [
      {
        id: "ch-1",
        platform: "telegram",
        platformChannelId: "1001",
        title: "Channel 1",
        sourceId: "acc-1",
        sourceName: "Source 1",
      } as unknown as ChannelWithSource,
    ];

    mockListChannelsWithSources
      .mockRejectedValueOnce(new Error("transient backend failure"))
      .mockResolvedValueOnce(sample);

    const { container, root } = renderHarness();
    await flushAsync();

    expect(latest!.error).toBe("transient backend failure");
    expect(latest!.channels).toEqual([]);

    act(() => {
      latest!.refresh();
    });
    await flushAsync();

    expect(latest!.error).toBeNull();
    expect(latest!.initialLoading).toBe(false);
    expect(latest!.channels).toEqual(sample);

    cleanup(root, container);
  });

  it("does not setState after unmount when a slow request later rejects", async () => {
    let rejectIt: (reason: unknown) => void = () => {};
    mockListChannelsWithSources.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectIt = reject;
      }),
    );

    const { container, root } = renderHarness();
    // Unmount before the request resolves.
    act(() => {
      root.unmount();
    });
    container.remove();

    // Now reject the in-flight request — must not throw.
    await act(async () => {
      rejectIt(new Error("late failure after unmount"));
      await Promise.resolve();
    });

    // No assertion errors means the unmount-guard worked. The toast must not
    // have fired because the hook short-circuits after unmount.
    expect(mockShowToast).not.toHaveBeenCalled();
  });
});
