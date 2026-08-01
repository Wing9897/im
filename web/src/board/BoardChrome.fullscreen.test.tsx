import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BoardChrome } from "./BoardChrome";
import { BOARD_CHROME_IDLE_MS } from "./useBoardChromeReveal";
import { useBoardFullscreen } from "./useBoardFullscreen";

vi.mock("../utils/errorReporter", () => ({
  captureError: vi.fn(),
}));

async function openFab(container: HTMLElement) {
  const toggle = container.querySelector(
    '[data-testid="board-fab-toggle"]',
  ) as HTMLButtonElement;
  act(() => {
    toggle.click();
  });
}

describe("BoardChrome canvas menu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function flush() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("enters edit with pen and keeps FAB actions pinned until done", async () => {
    function Harness() {
      const [editMode, setEditMode] = useState<"view" | "edit">("view");
      return createElement(BoardChrome, {
        editMode,
        isFullscreen: false,
        onEditModeChange: setEditMode,
        onAddWidget: () => {},
        onResetLayout: () => {},
        onToggleFullscreen: () => {},
      });
    }
    act(() => {
      root.render(createElement(Harness));
    });
    await flush();

    expect(container.querySelector('[data-testid="board-fab-actions"]')).toBeNull();
    expect(container.querySelector('[data-testid="board-fab-hotspot"]')).toBeTruthy();
    // Fullscreen sits on the FAB stack in view mode (no need to enter edit).
    expect(container.querySelector('[data-testid="board-toggle-fullscreen"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-enter-edit"]')).toBeNull();

    const toggle = container.querySelector(
      '[data-testid="board-fab-toggle"]',
    ) as HTMLButtonElement;
    expect(toggle.getAttribute("aria-label")).toBe("編輯");
    expect(toggle.getAttribute("title")).toBe("編輯");

    await openFab(container);
    await flush();
    // First click enters edit and pins tools open.
    const actions = container.querySelector('[data-testid="board-fab-actions"]');
    expect(actions?.classList.contains("board-chrome__fab-actions--open")).toBe(true);
    expect(container.querySelector(".board-chrome--open")).toBeTruthy();
    expect(container.querySelector('[data-testid="board-add-widget"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-enter-edit"]')).toBeNull();
    expect(container.querySelector('[data-testid="board-toggle-fullscreen"]')).toBeTruthy();

    // Outside click must not collapse edit tools.
    act(() => {
      document.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });
    await flush();
    expect(
      container
        .querySelector('[data-testid="board-fab-actions"]')
        ?.classList.contains("board-chrome__fab-actions--open"),
    ).toBe(true);

    // Pen click while editing also keeps tools open.
    await openFab(container);
    await flush();
    expect(container.querySelector('[data-testid="board-fab-actions"]')).toBeTruthy();

    act(() => {
      (container.querySelector('[data-testid="board-done-edit"]') as HTMLButtonElement).click();
    });
    await flush();
    expect(container.querySelector('[data-testid="board-fab-actions"]')).toBeNull();
    expect(container.querySelector(".board-chrome--open")).toBeNull();
  });

  it("calls onToggleFullscreen from FAB without entering edit", async () => {
    const onToggleFullscreen = vi.fn();
    act(() => {
      root.render(
        createElement(BoardChrome, {
          editMode: "view",
          isFullscreen: false,
          onEditModeChange: () => {},
          onAddWidget: () => {},
          onResetLayout: () => {},
          onToggleFullscreen,
        }),
      );
    });
    await flush();
    act(() => {
      (
        container.querySelector(
          '[data-testid="board-toggle-fullscreen"]',
        ) as HTMLButtonElement
      ).click();
    });
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="board-fab-actions"]')).toBeNull();
  });

  it("keeps board-chrome FAB dock for CSS targeting", async () => {
    act(() => {
      root.render(
        createElement("div", { className: "board-root" },
          createElement(BoardChrome, {
            editMode: "view",
            onEditModeChange: () => {},
            onAddWidget: () => {},
            onResetLayout: () => {},
          }),
        ),
      );
    });
    await flush();
    expect(container.querySelector('[data-testid="board-chrome"]')).toBeTruthy();
    expect(container.querySelector(".board-chrome__fab-stack")).toBeTruthy();
    expect(container.querySelector('[data-testid="board-fab-toggle"]')).toBeTruthy();
  });

  it("auto-hides view-mode FAB after idle and reveals on mousemove", async () => {
    vi.useFakeTimers();
    act(() => {
      root.render(
        createElement(BoardChrome, {
          editMode: "view",
          isFullscreen: false,
          onEditModeChange: () => {},
          onAddWidget: () => {},
          onResetLayout: () => {},
          onExportLayout: () => {},
          onImportLayout: async () => {},
          onToggleFullscreen: () => {},
        }),
      );
    });
    await flush();

    const chrome = container.querySelector('[data-testid="board-chrome"]') as HTMLElement;
    expect(chrome.getAttribute("data-chrome-revealed")).toBe("true");
    expect(chrome.classList.contains("board-chrome--idle")).toBe(false);

    act(() => {
      vi.advanceTimersByTime(BOARD_CHROME_IDLE_MS + 50);
    });
    expect(chrome.getAttribute("data-chrome-revealed")).toBe("false");
    expect(chrome.classList.contains("board-chrome--idle")).toBe(true);

    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    });
    expect(chrome.getAttribute("data-chrome-revealed")).toBe("true");
    expect(chrome.classList.contains("board-chrome--idle")).toBe(false);

    vi.useRealTimers();
  });

  it("keeps FAB revealed while editing (no idle hide)", async () => {
    vi.useFakeTimers();
    act(() => {
      root.render(
        createElement(BoardChrome, {
          editMode: "edit",
          isFullscreen: false,
          onEditModeChange: () => {},
          onAddWidget: () => {},
          onResetLayout: () => {},
          onExportLayout: () => {},
          onImportLayout: async () => {},
          onToggleFullscreen: () => {},
        }),
      );
    });
    await flush();

    const chrome = container.querySelector('[data-testid="board-chrome"]') as HTMLElement;
    act(() => {
      vi.advanceTimersByTime(BOARD_CHROME_IDLE_MS * 3);
    });
    expect(chrome.classList.contains("board-chrome--idle")).toBe(false);
    expect(chrome.getAttribute("data-chrome-revealed")).toBe("true");
    expect(container.querySelector('[data-testid="board-fab-actions"]')).toBeTruthy();

    vi.useRealTimers();
  });

  it("pins FAB reveal while hotspot is hovered", async () => {
    vi.useFakeTimers();
    act(() => {
      root.render(
        createElement(BoardChrome, {
          editMode: "view",
          onEditModeChange: () => {},
          onAddWidget: () => {},
          onResetLayout: () => {},
          onExportLayout: () => {},
          onImportLayout: async () => {},
          onToggleFullscreen: () => {},
        }),
      );
    });
    await flush();

    const chrome = container.querySelector('[data-testid="board-chrome"]') as HTMLElement;
    const hotspot = container.querySelector(
      '[data-testid="board-fab-hotspot"]',
    ) as HTMLElement;

    act(() => {
      hotspot.dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body }),
      );
      vi.advanceTimersByTime(BOARD_CHROME_IDLE_MS * 3);
    });
    expect(chrome.classList.contains("board-chrome--idle")).toBe(false);

    act(() => {
      hotspot.dispatchEvent(
        new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }),
      );
      vi.advanceTimersByTime(BOARD_CHROME_IDLE_MS + 50);
    });
    expect(chrome.classList.contains("board-chrome--idle")).toBe(true);

    vi.useRealTimers();
  });
});

describe("useBoardFullscreen", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it("sets data-board-immersive when toggled", async () => {
    const immersiveLog: boolean[] = [];
    const requestFullscreen = vi.fn(async function (this: HTMLElement) {
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        get: () => this,
      });
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    const exitFullscreen = vi.fn(async () => {
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        get: () => null,
      });
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    HTMLElement.prototype.requestFullscreen = requestFullscreen;
    document.exitFullscreen = exitFullscreen;

    function Harness() {
      const { containerRef, toggleFullscreen } = useBoardFullscreen((v) =>
        immersiveLog.push(v),
      );
      return createElement(
        "div",
        { ref: containerRef, "data-testid": "fs-root" },
        createElement("button", {
          type: "button",
          "data-testid": "fs-btn",
          onClick: () => void toggleFullscreen(),
        }),
      );
    }

    await act(async () => {
      root.render(createElement(Harness));
      await Promise.resolve();
    });

    await act(async () => {
      (container.querySelector('[data-testid="fs-btn"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(requestFullscreen).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="fs-root"]')?.getAttribute("data-board-immersive")).toBe(
      "true",
    );
    expect(immersiveLog).toContain(true);
  });
});

describe("immersive shell flag", () => {
  it("tracks immersive boolean for App chrome hide", () => {
    function Track() {
      const [immersive, setImmersive] = useState(false);
      return createElement(
        "div",
        { "data-board-immersive": immersive ? "true" : undefined },
        createElement("button", {
          type: "button",
          "data-testid": "toggle",
          onClick: () => setImmersive((v) => !v),
        }),
      );
    }
    const el = document.createElement("div");
    document.body.appendChild(el);
    const r = createRoot(el);
    act(() => {
      r.render(createElement(Track));
    });
    expect(el.querySelector("[data-board-immersive]")).toBeNull();
    act(() => {
      (el.querySelector('[data-testid="toggle"]') as HTMLButtonElement).click();
    });
    expect(el.querySelector("[data-board-immersive]")?.getAttribute("data-board-immersive")).toBe(
      "true",
    );
    act(() => r.unmount());
    document.body.removeChild(el);
  });

  it("CSS suppresses frame header hover reveal while board immersive", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/css/board-core.css"),
      "utf-8",
    );
    expect(css).toContain(
      ".board-root[data-board-immersive] .board-canvas:not(.board-canvas--edit) .board-widget-frame:hover .board-widget-frame__header",
    );
    expect(css).toContain(
      ".board-root[data-board-immersive] .board-canvas:not(.board-canvas--edit) .board-widget-frame:focus-within .board-widget-frame__header",
    );
  });
});
