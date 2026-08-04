/**
 * Rendering variant tests for LogList.
 *
 * Rendering variant tests for components that behave differently based on
 * data size: empty list, single item, many items, pagination boundary.
 *
 * LogList renders a list of AppLogEntry rows with a load-more sentinel
 * underneath. Its rendering changes by:
 *   - Empty list (only the sentinel renders)
 *   - Single item (exactly one card + sentinel)
 *   - Many items (all rows render in order)
 *   - hasMoreLogs boundary (at-limit = button hidden; over-limit = button shown)
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LogList } from "./LogList";
import type { AppLogEntry } from "../../context/appRuntimeShared";

function makeLog(overrides: Partial<AppLogEntry> = {}): AppLogEntry {
  return {
    id: "log-1",
    time: "2026-01-01T00:00:00.000Z",
    level: "info",
    category: "system",
    kind: "event",
    message: "Default log message",
    details: undefined,
    ...overrides,
  };
}

interface RenderArgs {
  filteredLogs?: AppLogEntry[];
  totalLogCount?: number;
  hasMoreLogs?: boolean;
  logsLoadingMore?: boolean;
  loadedLogsSummary?: string;
}

function renderLogList(container: HTMLElement, args: RenderArgs = {}) {
  const props = {
    filteredLogs: args.filteredLogs ?? [],
    totalLogCount: args.totalLogCount ?? 0,
    hasMoreLogs: args.hasMoreLogs ?? false,
    logsLoadingMore: args.logsLoadingMore ?? false,
    loadedLogsSummary: args.loadedLogsSummary ?? "0 / 0",
    setSelectedLogId: vi.fn(),
    setLoadMoreNode: vi.fn(),
    setScrollContainerNode: vi.fn(),
    onLoadMoreLogs: vi.fn(async () => {}),
  };
  let root: Root | null = null;
  act(() => {
    root = createRoot(container);
    root.render(createElement(LogList, props));
  });
  return { props, root: root! };
}

describe("LogList — empty state variant", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
    }
    root = null;
    container.remove();
  });

  it("renders no log articles when filteredLogs is empty", () => {
    ({ root } = renderLogList(container, {
      filteredLogs: [],
      totalLogCount: 0,
    }));

    const articles = container.querySelectorAll("article");
    expect(articles.length).toBe(0);
  });

  it("renders the 'all loaded' sentinel summary when total is 0 and no more available", () => {
    ({ root } = renderLogList(container, {
      filteredLogs: [],
      totalLogCount: 0,
      hasMoreLogs: false,
    }));

    expect(container.textContent).toContain("已載入全部 0 筆日誌");
  });

  it("does not render a load-more button when hasMoreLogs is false", () => {
    ({ root } = renderLogList(container, {
      filteredLogs: [],
      hasMoreLogs: false,
    }));

    const loadMoreButton = Array.from(
      container.querySelectorAll("button"),
    ).find((b) => b.textContent === "載入更多");
    expect(loadMoreButton).toBeUndefined();
  });
});

describe("LogList — single item variant", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
    }
    root = null;
    container.remove();
  });

  it("renders exactly one article when filteredLogs has a single entry", () => {
    ({ root } = renderLogList(container, {
      filteredLogs: [makeLog({ message: "Only entry" })],
      totalLogCount: 1,
    }));

    const articles = container.querySelectorAll("article");
    expect(articles.length).toBe(1);
    expect(articles[0].textContent).toContain("Only entry");
  });

  it("displays the level uppercase in the single item", () => {
    ({ root } = renderLogList(container, {
      filteredLogs: [makeLog({ level: "warning", message: "Single warning" })],
      totalLogCount: 1,
    }));

    expect(container.textContent).toContain("WARNING");
  });
});

describe("LogList — many items variant", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
    }
    root = null;
    container.remove();
  });

  it("renders one article per entry in the same order they are provided", () => {
    const logs: AppLogEntry[] = Array.from({ length: 25 }, (_, i) =>
      makeLog({
        id: `log-${i}`,
        message: `Message ${i}`,
        time: `2026-01-01T00:${String(i).padStart(2, "0")}:00.000Z`,
      }),
    );
    ({ root } = renderLogList(container, {
      filteredLogs: logs,
      totalLogCount: 25,
    }));

    const articles = container.querySelectorAll("article");
    expect(articles.length).toBe(25);

    // Verify order is preserved.
    for (let i = 0; i < logs.length; i++) {
      expect(articles[i].textContent).toContain(`Message ${i}`);
    }
  });

  it("scroll container has overflow-y auto for vertical scrolling with many items", () => {
    const logs: AppLogEntry[] = Array.from({ length: 100 }, (_, i) =>
      makeLog({ id: `log-${i}`, message: `Message ${i}` }),
    );
    ({ root } = renderLogList(container, {
      filteredLogs: logs,
      totalLogCount: 100,
    }));

    const scrollContainer = container.firstElementChild as HTMLDivElement;
    expect(scrollContainer.classList.contains("overflow-y-auto")).toBe(true);
    expect(scrollContainer.classList.contains("max-h-[65vh]")).toBe(true);
  });
});

describe("LogList — pagination boundary variant", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
    }
    root = null;
    container.remove();
  });

  it("at-limit (loaded == total): hides load-more button and shows 'all loaded' message", () => {
    const logs: AppLogEntry[] = Array.from({ length: 50 }, (_, i) =>
      makeLog({ id: `log-${i}`, message: `Message ${i}` }),
    );
    ({ root } = renderLogList(container, {
      filteredLogs: logs,
      totalLogCount: 50,
      hasMoreLogs: false,
      loadedLogsSummary: "50 / 50",
    }));

    expect(container.textContent).toContain("已載入全部 50 筆日誌");

    const loadMoreButton = Array.from(
      container.querySelectorAll("button"),
    ).find((b) => b.textContent === "載入更多");
    expect(loadMoreButton).toBeUndefined();
  });

  it("over-limit (hasMoreLogs=true, not loading): shows load-more button and 'continue loading' message", () => {
    const logs: AppLogEntry[] = Array.from({ length: 50 }, (_, i) =>
      makeLog({ id: `log-${i}`, message: `Message ${i}` }),
    );
    ({ root } = renderLogList(container, {
      filteredLogs: logs,
      totalLogCount: 100,
      hasMoreLogs: true,
      loadedLogsSummary: "50 / 100",
    }));

    expect(container.textContent).toContain(
      "已載入 50 / 100，向下捲動或按下方按鈕繼續載入",
    );

    const loadMoreButton = Array.from(
      container.querySelectorAll("button"),
    ).find((b) => b.textContent === "載入更多");
    expect(loadMoreButton).toBeDefined();
  });

  it("loading-more state: hides load-more button and shows loading spinner text", () => {
    const logs: AppLogEntry[] = Array.from({ length: 50 }, (_, i) =>
      makeLog({ id: `log-${i}`, message: `Message ${i}` }),
    );
    ({ root } = renderLogList(container, {
      filteredLogs: logs,
      totalLogCount: 100,
      hasMoreLogs: true,
      logsLoadingMore: true,
      loadedLogsSummary: "50 / 100",
    }));

    expect(container.textContent).toContain("載入更多日誌中…");

    const loadMoreButton = Array.from(
      container.querySelectorAll("button"),
    ).find((b) => b.textContent === "載入更多");
    expect(loadMoreButton).toBeUndefined();
  });

  it("clicking load-more invokes the onLoadMoreLogs callback exactly once", () => {
    const logs: AppLogEntry[] = [makeLog()];
    const { props } = renderLogList(container, {
      filteredLogs: logs,
      totalLogCount: 10,
      hasMoreLogs: true,
      loadedLogsSummary: "1 / 10",
    });
    root = null; // reset since renderLogList creates root on its own; we keep below

    const loadMoreButton = Array.from(
      container.querySelectorAll("button"),
    ).find((b) => b.textContent === "載入更多");
    expect(loadMoreButton).toBeDefined();

    act(() => {
      loadMoreButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(props.onLoadMoreLogs).toHaveBeenCalledTimes(1);
  });
});
