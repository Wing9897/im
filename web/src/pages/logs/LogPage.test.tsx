import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LONG_LOG_TEXT,
  MockIntersectionObserver,
  runtimeLogPageState,
} from "../../test/logPageMocks";

vi.mock("../../context/runtimeLogs/RuntimeLogsContext", async () =>
  (await import("../../test/logPageMocks")).runtimeLogsModuleMock(),
);
vi.mock("../../context/AnalysisStatusContext", async () =>
  (await import("../../test/logPageMocks")).analysisStatusLogPageModuleMock(),
);
vi.mock("../shared/WorkspaceShell", async () =>
  (await import("../../test/logPageMocks")).workspaceShellLogPageModuleMock(),
);

import { LogPage } from "./LogPage";

describe("LogPage", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    window.localStorage.clear();
    runtimeLogPageState.logs = [
      {
        id: "log-1",
        time: "2026-04-17T03:00:00.000Z",
        level: "info",
        category: "system",
        message: "Persisted log entry",
      },
    ];
    runtimeLogPageState.totalLogCount = 1;
    runtimeLogPageState.hasMoreLogs = false;
    runtimeLogPageState.logsLoading = false;
    runtimeLogPageState.logsLoadingMore = false;
    runtimeLogPageState.logLoadError = null;
    runtimeLogPageState.clearLogs.mockClear();
    runtimeLogPageState.refreshLogs.mockClear();
    runtimeLogPageState.loadMoreLogs.mockClear();
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function renderPage() {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(LogPage));
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("falls back to all filters when persisted values are invalid", async () => {
    window.localStorage.setItem(
      "im:logs:level-filter",
      JSON.stringify("verbose"),
    );
    window.localStorage.setItem(
      "im:logs:category-filter",
      JSON.stringify("backend"),
    );

    await renderPage();

    expect(
      container.querySelector('[data-testid="log-level-filter-value"]')?.textContent,
    ).toMatch(/全部|All/i);
    expect(
      container.querySelector('[data-testid="log-category-filter-value"]')?.textContent,
    ).toMatch(/全部|All/i);
    expect(container.textContent).toContain("Persisted log entry");
    // Mount refreshes once when Logs acquires runtime interest; no interval poll.
    expect(runtimeLogPageState.refreshLogs).toHaveBeenCalledTimes(1);
  });

  it("does not poll shared logs on an interval", async () => {
    vi.useFakeTimers();

    await renderPage();

    expect(runtimeLogPageState.refreshLogs).toHaveBeenCalledTimes(1);
    runtimeLogPageState.refreshLogs.mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(runtimeLogPageState.refreshLogs).not.toHaveBeenCalled();
  });

  it("shows a recovery state when log loading is stalled or has already failed", async () => {
    vi.useFakeTimers();
    runtimeLogPageState.logs = [];
    runtimeLogPageState.totalLogCount = 0;
    runtimeLogPageState.logsLoading = true;
    runtimeLogPageState.logLoadError = "Error: 系統日誌載入逾時，請稍後再試。";

    await renderPage();

    expect(container.textContent).toContain("系統日誌目前無法完成載入");
    expect(container.textContent).toContain("最近一次載入失敗");
  });

  it("keeps rendering existing logs when the latest refresh fails", async () => {
    runtimeLogPageState.logs = [
      {
        id: "log-cached",
        time: "2026-04-17T03:00:00.000Z",
        level: "info",
        category: "system",
        message: "Cached persisted log",
      },
    ];
    runtimeLogPageState.totalLogCount = 1;
    runtimeLogPageState.logsLoading = false;
    runtimeLogPageState.logLoadError = "系統日誌載入逾時，請稍後再試。";

    await renderPage();

    expect(container.textContent).toContain("Cached persisted log");
    expect(container.textContent).not.toContain("系統日誌目前無法完成載入");
  });

  it("renders pagination summary and calls loadMoreLogs", async () => {
    runtimeLogPageState.totalLogCount = 3;
    runtimeLogPageState.hasMoreLogs = true;

    await renderPage();

    expect(container.textContent).toContain("已載入 1 / 3");

    const loadMoreButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent === "載入更多");
    expect(loadMoreButton).toBeTruthy();

    await act(async () => {
      loadMoreButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });

    expect(runtimeLogPageState.loadMoreLogs).toHaveBeenCalledTimes(1);
  });

  it("opens a detail dialog for every log card and shows full content", async () => {
    runtimeLogPageState.logs = [
      {
        id: "log-long",
        time: "2026-04-17T03:00:00.000Z",
        level: "success",
        category: "source",
        message:
          "這是一段很長的事件訊息，用來確認卡片會維持摘要顯示，但點開後仍可看到完整內容與原始訊息。",
        details:
          '{"source_id":"acct-1","channel_ids":["-1001","-1002","-1003"],"status":"subscribed"}',
      },
    ];
    runtimeLogPageState.totalLogCount = 1;

    await renderPage();

    expect(container.textContent).toContain("SUCCESS");

    const detailTrigger = container.querySelector(
      '[aria-label^="查看事件詳情："]',
    );
    expect(detailTrigger).toBeTruthy();

    await act(async () => {
      detailTrigger!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("事件訊息");
    expect(document.body.textContent).toContain("負載");
    expect(document.body.textContent).toContain(
      "這是一段很長的事件訊息，用來確認卡片會維持摘要顯示，但點開後仍可看到完整內容與原始訊息。",
    );
    expect(document.body.textContent).toContain('"status": "subscribed"');
  });

  it("applies SettingsContentCard padding on the page shell", async () => {
    await renderPage();

    const card = container.firstElementChild as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.className).toContain("rounded-lg");
    expect(card.className).toContain("px-md");
    expect(card.className).toContain("py-md");
  });
});

describe("LogPage log list row styling", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    window.localStorage.clear();
    runtimeLogPageState.logs = [
      {
        id: "log-1",
        time: "2026-04-17T03:00:00.000Z",
        level: "info",
        category: "system",
        message: LONG_LOG_TEXT,
        details: "Detail " + LONG_LOG_TEXT,
      },
      {
        id: "log-2",
        time: "2026-04-17T04:00:00.000Z",
        level: "error",
        category: "analysis",
        message: "Short message",
      },
    ];
    runtimeLogPageState.totalLogCount = 2;
    runtimeLogPageState.hasMoreLogs = false;
    runtimeLogPageState.logsLoading = false;
    runtimeLogPageState.logsLoadingMore = false;
    runtimeLogPageState.logLoadError = null;
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
    vi.unstubAllGlobals();
  });

  async function renderPage() {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(LogPage));
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("renders each log entry as a selectable list row article", async () => {
    await renderPage();

    const logItems = container.querySelectorAll('article[role="button"]');
    expect(logItems.length).toBe(2);
    for (const item of logItems) {
      expect(item.classList.contains("flex")).toBe(true);
      expect(item.classList.contains("min-h-11")).toBe(true);
    }
  });

  it("level renders as an uppercase status chip", async () => {
    await renderPage();

    const firstItem = container.querySelector(
      'article[role="button"]',
    ) as HTMLElement;
    const levelChip = Array.from(firstItem.querySelectorAll("span")).find(
      (el) => el.textContent === "INFO",
    );
    expect(levelChip).toBeTruthy();
    expect(levelChip!.classList.contains("text-info")).toBe(true);
  });

  it("error level uses the error chip variant", async () => {
    await renderPage();

    const items = container.querySelectorAll('article[role="button"]');
    const errorItem = items[1] as HTMLElement;
    const errorChip = Array.from(errorItem.querySelectorAll("span")).find(
      (el) => el.textContent === "ERROR",
    );
    expect(errorChip).toBeTruthy();
    expect(errorChip!.classList.contains("text-error")).toBe(true);
  });

  it("category renders as localized uppercase meta span", async () => {
    await renderPage();

    const firstItem = container.querySelector(
      'article[role="button"]',
    ) as HTMLElement;
    const categorySpan = Array.from(firstItem.querySelectorAll("span")).find(
      (el) => el.textContent === "系統",
    );
    expect(categorySpan).toBeTruthy();
    expect(categorySpan!.classList.contains("uppercase")).toBe(true);
  });

  it("timestamp renders in a mono time element", async () => {
    await renderPage();

    const firstItem = container.querySelector(
      'article[role="button"]',
    ) as HTMLElement;
    const time = firstItem.querySelector("time");
    expect(time).toBeTruthy();
    expect(time!.classList.contains("font-mono")).toBe(true);
    expect(time!.classList.contains("w-[140px]")).toBe(true);
  });

  it("list row shows i18n message only without raw details dump", async () => {
    await renderPage();

    const firstItem = container.querySelector(
      'article[role="button"]',
    ) as HTMLElement;
    const main = firstItem.querySelector(".text-ellipsis");
    expect(main).toBeTruthy();
    expect(main!.textContent).toContain(LONG_LOG_TEXT);
    expect(main!.textContent).not.toContain("Detail");
  });

  it("no element inside any row uses -webkit-box line clamping", async () => {
    await renderPage();

    const logItems = container.querySelectorAll('article[role="button"]');
    expect(logItems.length).toBeGreaterThan(0);
    for (const item of logItems) {
      for (const el of item.querySelectorAll<HTMLElement>("*")) {
        expect(el.style.display).not.toBe("-webkit-box");
        expect(el.style.webkitLineClamp ?? "").toBe("");
      }
    }
  });

  it("rows live inside the DataList scroll container", async () => {
    await renderPage();

    const scrollContainer = container.querySelector(
      ".im-auto-scrollbar",
    ) as HTMLElement;
    expect(scrollContainer).toBeTruthy();
    expect(scrollContainer.classList.contains("overflow-y-auto")).toBe(true);
    expect(
      scrollContainer.querySelectorAll('article[role="button"]').length,
    ).toBe(2);
  });

  it("rows opt out of the global hover-lift transform", async () => {
    await renderPage();

    const logItems = container.querySelectorAll('article[role="button"]');
    for (const item of logItems) {
      expect(item.hasAttribute("data-no-hover-lift")).toBe(true);
    }
  });
});
