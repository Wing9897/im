import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import {
  MONITOR_MODE_KEY,
  PAGES_LAST_PATH_KEY,
  MonitorModeProvider,
  useMonitorMode,
} from "./MonitorModeContext";

function LocationProbe({ onPath }: { onPath: (path: string) => void }) {
  const location = useLocation();
  useEffect(() => {
    onPath(`${location.pathname}${location.search}${location.hash}`);
  }, [location.hash, location.pathname, location.search, onPath]);
  return null;
}

function ModeControls() {
  const { monitorMode, setMonitorMode, openInPages } = useMonitorMode();
  const navigate = useNavigate();
  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "mode" }, monitorMode),
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "open-intelligence",
        onClick: () => openInPages("/intelligence?view=map"),
      },
      "open",
    ),
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "to-canvas",
        onClick: () => setMonitorMode("canvas"),
      },
      "canvas",
    ),
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "to-pages",
        onClick: () => setMonitorMode("pages"),
      },
      "pages",
    ),
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "nav-sources",
        onClick: () => navigate("/sources"),
      },
      "sources",
    ),
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "nav-timeline",
        onClick: () => navigate("/timeline"),
      },
      "timeline",
    ),
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "nav-settings",
        onClick: () => navigate("/settings"),
      },
      "settings",
    ),
  );
}

/** Captures setMonitorMode identity so tests can assert it survives pathname churn. */
function SetMonitorModeProbe({
  onSetMonitorMode,
}: {
  onSetMonitorMode: (fn: (mode: "pages" | "canvas") => void) => void;
}) {
  const { setMonitorMode } = useMonitorMode();
  useEffect(() => {
    onSetMonitorMode(setMonitorMode);
  }, [onSetMonitorMode, setMonitorMode]);
  return null;
}

/** Captures openInPages identity so tests can assert it survives pathname churn. */
function OpenInPagesProbe({
  onOpenInPages,
}: {
  onOpenInPages: (fn: (path: string) => void) => void;
}) {
  const { openInPages } = useMonitorMode();
  useEffect(() => {
    onOpenInPages(openInPages);
  }, [onOpenInPages, openInPages]);
  return null;
}

describe("MonitorModeContext", () => {
  let container: HTMLDivElement;
  let root: Root;
  let lastPath = "";

  beforeEach(() => {
    window.localStorage.clear();
    lastPath = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    window.localStorage.clear();
  });

  function renderAt(initialPath: string) {
    act(() => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: [initialPath] },
          createElement(
            MonitorModeProvider,
            null,
            createElement(LocationProbe, {
              onPath: (path) => {
                lastPath = path;
              },
            }),
            createElement(ModeControls),
          ),
        ),
      );
    });
  }

  async function flush() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("openInPages switches to pages mode and navigates", async () => {
    window.localStorage.setItem(MONITOR_MODE_KEY, "canvas");
    renderAt("/monitor");
    await flush();

    expect(container.querySelector('[data-testid="mode"]')?.textContent).toBe("canvas");

    act(() => {
      (container.querySelector('[data-testid="open-intelligence"]') as HTMLButtonElement).click();
    });
    await flush();

    expect(container.querySelector('[data-testid="mode"]')?.textContent).toBe("pages");
    expect(lastPath).toBe("/intelligence?view=map");
    expect(window.localStorage.getItem(MONITOR_MODE_KEY)).toBe("pages");
    expect(window.localStorage.getItem(PAGES_LAST_PATH_KEY)).toBe("/intelligence?view=map");
  });

  it("restores stored pages path when leaving canvas", async () => {
    window.localStorage.setItem(MONITOR_MODE_KEY, "canvas");
    window.localStorage.setItem(PAGES_LAST_PATH_KEY, "/timeline");
    renderAt("/monitor");
    await flush();

    act(() => {
      (container.querySelector('[data-testid="to-pages"]') as HTMLButtonElement).click();
    });
    await flush();

    expect(container.querySelector('[data-testid="mode"]')?.textContent).toBe("pages");
    expect(lastPath).toBe("/timeline");
  });

  it("remembers current path when entering canvas", async () => {
    renderAt("/sources");
    await flush();

    act(() => {
      (container.querySelector('[data-testid="to-canvas"]') as HTMLButtonElement).click();
    });
    await flush();

    expect(window.localStorage.getItem(MONITOR_MODE_KEY)).toBe("canvas");
    expect(window.localStorage.getItem(PAGES_LAST_PATH_KEY)).toBe("/sources");
  });

  it("keeps setMonitorMode identity across pathname-only navigations", async () => {
    const identities: Array<(mode: "pages" | "canvas") => void> = [];
    act(() => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/monitor"] },
          createElement(
            MonitorModeProvider,
            null,
            createElement(LocationProbe, {
              onPath: (path) => {
                lastPath = path;
              },
            }),
            createElement(SetMonitorModeProbe, {
              onSetMonitorMode: (fn) => {
                identities.push(fn);
              },
            }),
            createElement(ModeControls),
          ),
        ),
      );
    });
    await flush();

    const first = identities[identities.length - 1];
    expect(first).toBeTypeOf("function");

    for (const testId of ["nav-sources", "nav-timeline", "nav-settings"] as const) {
      act(() => {
        (container.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement).click();
      });
      await flush();
    }

    expect(lastPath).toBe("/settings");
    expect(identities[identities.length - 1]).toBe(first);
    // Probe effect only ran for the stable identity — no pathname-driven resubscribe.
    expect(identities).toHaveLength(1);
  });

  it("keeps openInPages identity across pathname-only navigations", async () => {
    const identities: Array<(path: string) => void> = [];
    act(() => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/monitor"] },
          createElement(
            MonitorModeProvider,
            null,
            createElement(LocationProbe, {
              onPath: (path) => {
                lastPath = path;
              },
            }),
            createElement(OpenInPagesProbe, {
              onOpenInPages: (fn) => {
                identities.push(fn);
              },
            }),
            createElement(ModeControls),
          ),
        ),
      );
    });
    await flush();

    const first = identities[identities.length - 1];
    expect(first).toBeTypeOf("function");

    for (const testId of ["nav-sources", "nav-timeline", "nav-settings"] as const) {
      act(() => {
        (container.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement).click();
      });
      await flush();
    }

    expect(lastPath).toBe("/settings");
    expect(identities[identities.length - 1]).toBe(first);
    // Probe effect only ran for the stable identity — no pathname-driven resubscribe.
    expect(identities).toHaveLength(1);
  });

  it("flips to pages immediately when already on the target path", async () => {
    window.localStorage.setItem(MONITOR_MODE_KEY, "canvas");
    window.localStorage.setItem(PAGES_LAST_PATH_KEY, "/monitor");
    renderAt("/monitor");
    await flush();

    expect(container.querySelector('[data-testid="mode"]')?.textContent).toBe("canvas");

    act(() => {
      (container.querySelector('[data-testid="to-pages"]') as HTMLButtonElement).click();
    });
    await flush();

    expect(container.querySelector('[data-testid="mode"]')?.textContent).toBe("pages");
    expect(lastPath).toBe("/monitor");
  });

  it("forces navigate to pending target after timeout if location never matches", async () => {
    vi.useFakeTimers();
    try {
      window.localStorage.setItem(MONITOR_MODE_KEY, "canvas");
      renderAt("/monitor");
      await flush();
      expect(container.querySelector('[data-testid="mode"]')?.textContent).toBe("canvas");

      // Arm pending for /intelligence?view=map, then navigate elsewhere in the same
      // act so the location-match effect never sees the pending target.
      act(() => {
        (container.querySelector('[data-testid="open-intelligence"]') as HTMLButtonElement).click();
        (container.querySelector('[data-testid="nav-sources"]') as HTMLButtonElement).click();
      });
      await flush();

      expect(container.querySelector('[data-testid="mode"]')?.textContent).toBe("canvas");
      expect(lastPath).toBe("/sources");

      await act(async () => {
        vi.advanceTimersByTime(1500);
        await Promise.resolve();
      });

      expect(container.querySelector('[data-testid="mode"]')?.textContent).toBe("pages");
      expect(window.localStorage.getItem(MONITOR_MODE_KEY)).toBe("pages");
      expect(lastPath).toBe("/intelligence?view=map");
    } finally {
      vi.useRealTimers();
    }
  });
});
