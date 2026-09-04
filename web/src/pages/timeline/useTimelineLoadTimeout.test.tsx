import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTimelineLoadTimeout } from "./useTimelineLoadTimeout";

describe("useTimelineLoadTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not time out while cached events exist", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    let timedOut = false;
    function Probe({ loading, hasEvents }: { loading: boolean; hasEvents: boolean }) {
      timedOut = useTimelineLoadTimeout(loading, hasEvents, 1_000).timedOut;
      return null;
    }
    act(() => {
      root.render(createElement(Probe, { loading: true, hasEvents: true }));
    });
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(timedOut).toBe(false);
    act(() => root.unmount());
  });

  it("times out only the empty initial load", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    let timedOut = false;
    function Probe({ loading, hasEvents }: { loading: boolean; hasEvents: boolean }) {
      timedOut = useTimelineLoadTimeout(loading, hasEvents, 1_000).timedOut;
      return null;
    }
    act(() => {
      root.render(createElement(Probe, { loading: true, hasEvents: false }));
    });
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(timedOut).toBe(true);
    act(() => root.unmount());
  });
});
