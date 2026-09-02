import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { Radio } from "lucide-react";
import {
  MONITOR_MODE_KEY,
  MonitorModeProvider,
  useMonitorMode,
} from "../context/MonitorModeContext";
import { SimpleModeProvider } from "../context/SimpleModeContext";
import { CommandPaletteProvider, useCommandPalette } from "./useCommandPalette";
import { AssistantQuickProvider } from "./useAssistantQuick";
import type { CommandPaletteItem } from "../domain/commandPalette/commandPaletteCommands";

vi.mock("../context/TaskCatalogContext", () => ({
  useTaskCatalog: () => ({ tasks: [] }),
}));

vi.mock("../domain/commandPalette/commandPaletteCommands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../domain/commandPalette/commandPaletteCommands")>();
  return {
    ...actual,
    runCommandPaletteAction: vi.fn(),
  };
});

function LocationProbe({ onPath }: { onPath: (path: string) => void }) {
  const location = useLocation();
  useEffect(() => {
    onPath(`${location.pathname}${location.search}${location.hash}`);
  }, [location.hash, location.pathname, location.search, onPath]);
  return null;
}

function PaletteHarness() {
  const { runItem } = useCommandPalette();
  const { monitorMode } = useMonitorMode();
  const item: CommandPaletteItem = {
    id: "nav-intelligence",
    label: "情報事件",
    to: "/intelligence",
    icon: Radio,
    group: "導航",
  };
  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "mode" }, monitorMode),
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "run-nav",
        onClick: () => runItem(item),
      },
      "run",
    ),
  );
}

describe("command palette canvas navigation", () => {
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

  function renderPalette() {
    act(() => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/monitor"] },
          createElement(
            SimpleModeProvider,
            null,
            createElement(
              MonitorModeProvider,
              null,
              createElement(
                AssistantQuickProvider,
                null,
                createElement(
                  CommandPaletteProvider,
                  null,
                  createElement(LocationProbe, {
                    onPath: (path) => {
                      lastPath = path;
                    },
                  }),
                  createElement(PaletteHarness),
                ),
              ),
            ),
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

  it("from canvas mode, navigation openInPages then lands on path", async () => {
    window.localStorage.setItem(MONITOR_MODE_KEY, "canvas");
    renderPalette();
    await flush();

    expect(container.querySelector('[data-testid="mode"]')?.textContent).toBe("canvas");

    act(() => {
      (container.querySelector('[data-testid="run-nav"]') as HTMLButtonElement).click();
    });
    await flush();

    expect(container.querySelector('[data-testid="mode"]')?.textContent).toBe("pages");
    expect(lastPath).toBe("/intelligence");
    expect(window.localStorage.getItem(MONITOR_MODE_KEY)).toBe("pages");
  });

  it("from pages mode, navigation only updates the route", async () => {
    renderPalette();
    await flush();

    expect(container.querySelector('[data-testid="mode"]')?.textContent).toBe("pages");

    act(() => {
      (container.querySelector('[data-testid="run-nav"]') as HTMLButtonElement).click();
    });
    await flush();

    expect(container.querySelector('[data-testid="mode"]')?.textContent).toBe("pages");
    expect(lastPath).toBe("/intelligence");
  });
});
