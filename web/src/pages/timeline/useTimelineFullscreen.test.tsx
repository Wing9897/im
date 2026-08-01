import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { useTimelineFullscreen } from "./useTimelineFullscreen";

vi.mock("../../utils/errorReporter", () => ({
  captureError: vi.fn(),
}));

function HookHarness({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useTimelineFullscreen>) => void;
}) {
  const api = useTimelineFullscreen();
  onReady(api);
  return createElement("div", { ref: api.containerRef, "data-testid": "fs-root" });
}

describe("useTimelineFullscreen", () => {
  let requestFullscreen: ReturnType<typeof vi.fn>;
  let exitFullscreen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    requestFullscreen = vi.fn().mockResolvedValue(undefined);
    exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreen,
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      writable: true,
      value: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests fullscreen on the container then exits", async () => {
    let api!: ReturnType<typeof useTimelineFullscreen>;
    const container = document.createElement("div");
    document.body.appendChild(container);
    act(() => {
      createRoot(container).render(
        createElement(HookHarness, {
          onReady: (next) => {
            api = next;
          },
        }),
      );
    });

    const root = container.querySelector("[data-testid='fs-root']") as HTMLDivElement;
    expect(root).toBeTruthy();

    await act(async () => {
      await api.toggleFullscreen();
    });
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(api.isFullscreen).toBe(true);

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: root,
    });

    await act(async () => {
      await api.toggleFullscreen();
    });
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(api.isFullscreen).toBe(false);

    document.body.removeChild(container);
  });

  it("syncs state when fullscreenchange fires", async () => {
    let api!: ReturnType<typeof useTimelineFullscreen>;
    const container = document.createElement("div");
    document.body.appendChild(container);
    act(() => {
      createRoot(container).render(
        createElement(HookHarness, {
          onReady: (next) => {
            api = next;
          },
        }),
      );
    });

    const root = container.querySelector("[data-testid='fs-root']") as HTMLDivElement;
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: root,
    });
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(api.isFullscreen).toBe(true);

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(api.isFullscreen).toBe(false);

    document.body.removeChild(container);
  });
});
