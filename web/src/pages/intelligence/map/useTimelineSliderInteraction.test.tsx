/**
 * Regression: leaving Live / dataRange expansion must NOT auto-rescale the
 * timeline viewport (was jumping ~36h → dataSpan×1.5 ≈ 1 week on first drag).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { TimeWindow } from "../../../types";
import {
  liveViewportSpanMs,
  useTimelineSliderInteraction,
} from "./useTimelineSliderInteraction";
import { ONE_HOUR } from "../../../domain/intelligence/timelineSliderLayout";

function Harness({
  dataRange,
  timeWindow,
  liveMode,
  selectionHalfMs,
  onExitLiveMode,
  onTimeWindowChange,
  onCommitFetchWindow,
}: {
  dataRange: TimeWindow;
  timeWindow: TimeWindow;
  liveMode: boolean;
  selectionHalfMs: number;
  onExitLiveMode: () => void;
  onTimeWindowChange: (w: TimeWindow) => void;
  onCommitFetchWindow?: (w: TimeWindow) => void;
}) {
  const interaction = useTimelineSliderInteraction({
    dataRange,
    timeWindow,
    liveMode,
    selectionHalfMs,
    onExitLiveMode,
    onTimeWindowChange,
    onCommitFetchWindow,
  });
  return createElement(
    "div",
    {
      "data-testid": "timeline-harness",
      "data-view-span": String(interaction.viewSpan),
      "data-view-start": String(interaction.viewStart),
    },
    createElement("canvas", {
      ref: interaction.canvasRef,
      onMouseDown: interaction.onMouseDown,
    }),
  );
}

describe("liveViewportSpanMs", () => {
  it("is wider than ±12h selection but not a week", () => {
    const half = 12 * ONE_HOUR;
    const span = liveViewportSpanMs(half);
    expect(span).toBeGreaterThanOrEqual(24 * ONE_HOUR);
    expect(span).toBeLessThanOrEqual(48 * ONE_HOUR);
    expect(span).toBe(Math.max(24 * ONE_HOUR * 1.5, 24 * ONE_HOUR + 6 * ONE_HOUR));
  });
});

describe("useTimelineSliderInteraction viewport", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function flush() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("does not auto-fit viewSpan when leaving Live after dataRange expands", async () => {
    const now = Date.UTC(2026, 6, 22, 8, 28);
    const half = 12 * ONE_HOUR;
    const narrow: TimeWindow = {
      start: new Date(now - 6 * ONE_HOUR),
      end: new Date(now + 6 * ONE_HOUR),
    };
    const wide: TimeWindow = {
      start: new Date(now - 3 * 24 * ONE_HOUR),
      end: new Date(now + 3 * 24 * ONE_HOUR),
    };
    const selection: TimeWindow = {
      start: new Date(now - half),
      end: new Date(now + half),
    };
    const expectedLiveSpan = liveViewportSpanMs(half);
    const onExit = vi.fn();

    function App() {
      const [live, setLive] = useState(true);
      const [range, setRange] = useState(narrow);
      return createElement(
        "div",
        null,
        createElement(Harness, {
          dataRange: range,
          timeWindow: selection,
          liveMode: live,
          selectionHalfMs: half,
          onExitLiveMode: () => {
            onExit();
            setLive(false);
          },
          onTimeWindowChange: () => {},
        }),
        createElement("button", {
          type: "button",
          "data-testid": "expand-data",
          onClick: () => setRange(wide),
        }),
        createElement("button", {
          type: "button",
          "data-testid": "leave-live",
          onClick: () => {
            onExit();
            setLive(false);
          },
        }),
      );
    }

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await flush();

    const readSpan = () =>
      Number(
        container.querySelector('[data-testid="timeline-harness"]')?.getAttribute("data-view-span"),
      );

    expect(readSpan()).toBe(expectedLiveSpan);

    // Live period: data range expands (fetch) — viewport must stay on Live span.
    act(() => {
      (container.querySelector('[data-testid="expand-data"]') as HTMLButtonElement).click();
    });
    await flush();
    expect(readSpan()).toBe(expectedLiveSpan);

    // Leave Live — must NOT jump to wide×1.5 (~1 week).
    act(() => {
      (container.querySelector('[data-testid="leave-live"]') as HTMLButtonElement).click();
    });
    await flush();
    expect(onExit).toHaveBeenCalled();
    expect(readSpan()).toBe(expectedLiveSpan);
    expect(readSpan()).toBeLessThan(5 * 24 * ONE_HOUR);
  });

  it("coalesces drag previews into one animation frame and commits the final window", async () => {
    const now = Date.UTC(2026, 6, 22, 8, 28);
    const selection = {
      start: new Date(now - 12 * ONE_HOUR),
      end: new Date(now + 12 * ONE_HOUR),
    };
    const frames: FrameRequestCallback[] = [];
    const onTimeWindowChange = vi.fn();
    const onCommitFetchWindow = vi.fn();
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    await act(async () => {
      root.render(
        createElement(Harness, {
          dataRange: selection,
          timeWindow: selection,
          liveMode: false,
          selectionHalfMs: 12 * ONE_HOUR,
          onExitLiveMode: () => {},
          onTimeWindowChange,
          onCommitFetchWindow,
        }),
      );
      await Promise.resolve();
    });

    const canvas = container.querySelector("canvas")!;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, width: 600, height: 44,
      top: 0, right: 600, bottom: 44, left: 0,
      toJSON: () => ({}),
    });

    act(() => {
      canvas.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 300 }));
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 320 }));
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 340 }));
    });

    expect(frames).toHaveLength(1);
    expect(onTimeWindowChange).not.toHaveBeenCalled();

    act(() => frames[0](0));
    expect(onTimeWindowChange).toHaveBeenCalledTimes(1);

    act(() => window.dispatchEvent(new MouseEvent("mouseup")));
    expect(onTimeWindowChange).toHaveBeenCalledTimes(2);
    expect(onCommitFetchWindow).toHaveBeenCalledTimes(1);
    expect(onCommitFetchWindow).toHaveBeenLastCalledWith(onTimeWindowChange.mock.calls[1][0]);
  });
});
