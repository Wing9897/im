import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  MONITOR_MODE_KEY,
  useMonitorMode,
} from "../context/MonitorModeContext";
import { wrapBoardProviders } from "./boardTestHarness";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "./useBoardWidgetPoll";

function PollProbe({
  fetcher,
  intervalMs,
}: {
  fetcher: () => Promise<string>;
  intervalMs: number;
}) {
  const { data, error, loading } = useBoardWidgetPoll(fetcher, intervalMs);
  const { monitorMode } = useMonitorMode();
  return createElement(
    "div",
    {
      "data-testid": "poll-probe",
      "data-mode": monitorMode,
      "data-loading": loading ? "1" : "0",
      "data-error": error ?? "",
      "data-value": data ?? "",
    },
    data ?? "",
  );
}

describe("useBoardWidgetPoll", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    window.localStorage.clear();
    vi.useRealTimers();
  });

  async function flushMicrotasks() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function render(mode: "pages" | "canvas", fetcher: () => Promise<string>) {
    window.localStorage.setItem(MONITOR_MODE_KEY, mode);
    act(() => {
      root.render(
        wrapBoardProviders(
          createElement(PollProbe, {
            fetcher,
            intervalMs: BOARD_POLL_MS.queue,
          }),
        ),
      );
    });
  }

  it("does not fetch while monitorMode is pages", async () => {
    const fetcher = vi.fn(async () => "hi");
    render("pages", fetcher);
    await flushMicrotasks();
    expect(fetcher).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="poll-probe"]')?.getAttribute("data-mode")).toBe(
      "pages",
    );
  });

  it("fetches immediately and polls on an interval in canvas mode", async () => {
    const fetcher = vi.fn(async () => "ok");
    render("canvas", fetcher);
    await flushMicrotasks();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(BOARD_POLL_MS.queue);
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("pauses polling when switching from canvas to pages", async () => {
    const fetcher = vi.fn(async () => "ok");
    render("canvas", fetcher);
    await flushMicrotasks();
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Flip mode via localStorage + remount provider path: use setMonitorMode through a button.
    function ModeFlipper() {
      const { setMonitorMode } = useMonitorMode();
      const { data } = useBoardWidgetPoll(fetcher, BOARD_POLL_MS.queue);
      return createElement(
        "div",
        null,
        createElement(
          "button",
          {
            "data-testid": "to-pages",
            type: "button",
            onClick: () => setMonitorMode("pages"),
          },
          "pages",
        ),
        createElement("span", { "data-testid": "val" }, data ?? ""),
      );
    }

    act(() => {
      root.render(wrapBoardProviders(createElement(ModeFlipper)));
    });
    await flushMicrotasks();
    const callsAfterMount = fetcher.mock.calls.length;

    act(() => {
      (container.querySelector('[data-testid="to-pages"]') as HTMLButtonElement).click();
    });
    await flushMicrotasks();

    await act(async () => {
      vi.advanceTimersByTime(BOARD_POLL_MS.queue * 3);
      await Promise.resolve();
    });
    expect(fetcher.mock.calls.length).toBe(callsAfterMount);
  });

  it("does not fetch when active option is false", async () => {
    const fetcher = vi.fn(async () => "nope");
    window.localStorage.setItem(MONITOR_MODE_KEY, "canvas");

    function InactiveProbe() {
      const { data } = useBoardWidgetPoll(fetcher, BOARD_POLL_MS.queue, { active: false });
      return createElement("span", { "data-testid": "inactive" }, data ?? "");
    }

    act(() => {
      root.render(wrapBoardProviders(createElement(InactiveProbe)));
    });
    await flushMicrotasks();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
