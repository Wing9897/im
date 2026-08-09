import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getTasksPageLabel } from "../domain/tasks/taskPageCopy";
import { SIMPLE_MODE_STORAGE_KEY } from "../domain/ui/simpleMode";
import { SimpleModeProvider } from "../context/SimpleModeContext";
import { SIDEBAR_COLLAPSED_KEY } from "../hooks/useSidebarCollapsed";
import { SIDEBAR_RAIL_MODE_KEY } from "../hooks/useSidebarRailMode";
import { ensureZhHantLocale, i18n, wrapWithI18n } from "../test/i18nHarness";
import { setAppLocale } from "../i18n/locale";

let mockPathname = "/monitor";
const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  NavLink: (props: {
    to: string;
    children: React.ReactNode;
    className?: string;
    "aria-label"?: string;
    title?: string;
    "data-testid"?: string;
  }) =>
    createElement(
      "a",
      {
        href: props.to,
        className: props.className,
        "aria-label": props["aria-label"],
        title: props.title,
        "data-testid": props["data-testid"] ?? "sidebar-link",
      },
      props.children,
    ),
  useLocation: () => ({ pathname: mockPathname }),
  useNavigate: () => mockNavigate,
}));

vi.mock("../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => ({
    queueStatus: { pendingCount: 0 },
    analysisPaused: false,
    activeAnalyses: new Map(),
    lastAnalysisEvent: null,
    lastSourceStatusChange: null,
    lastMessagesUpdate: null,
    requestQueueStatusRefresh: () => {},
  }),
}));

const { AppSidebar } = await import("./AppSidebar");

function isActiveSidebarLink(link: HTMLAnchorElement): boolean {
  return link.className.includes("bg-[color-mix(in_srgb,var(--text-primary)_6%");
}

describe("AppSidebar", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    mockPathname = "/monitor";
    mockNavigate.mockReset();
    window.localStorage.clear();
    await ensureZhHantLocale();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    act(() => root.unmount());
    document.body.removeChild(container);
    window.localStorage.clear();
    await ensureZhHantLocale();
  });

  function renderSidebar() {
    act(() => {
      root.render(
        wrapWithI18n(createElement(SimpleModeProvider, null, createElement(AppSidebar))),
      );
    });
  }

  function getLinks() {
    return Array.from(
      container.querySelectorAll<HTMLAnchorElement>("a[data-testid='sidebar-link']"),
    );
  }

  it("renders 選單/紀錄 mode toggle without logo brand", () => {
    renderSidebar();
    expect(container.querySelector("[data-testid='sidebar-rail-nav']")).toBeTruthy();
    expect(container.querySelector("[data-testid='sidebar-rail-history']")).toBeTruthy();
    expect(container.textContent).toContain("選單");
    expect(container.textContent).toContain("紀錄");
    expect(container.textContent).not.toMatch(/\bIM\b/);
    expect(container.querySelector("[data-testid='sidebar-collapse']")).toBeNull();
  });

  it("renders all navigation links with correct hrefs including 助手", () => {
    renderSidebar();
    const hrefs = getLinks().map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/monitor",
      "/tasks",
      "/items",
      "/sources",
      "/leaderboard",
      "/intelligence",
      "/timeline",
      "/actions",
      "/assistant",
      "/ai/provider",
      "/settings",
      "/account/identity",
    ]);
  });

  it("renders visual nav group labels in zh-Hant", () => {
    renderSidebar();
    expect(container.textContent).toContain("管理");
    expect(container.textContent).toContain("情報");
    expect(container.textContent).toContain("時間");
    expect(container.textContent).toContain("互動");
    expect(
      container.querySelectorAll("[data-testid='sidebar-nav-group']").length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("renders visual nav group labels in en", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    renderSidebar();
    expect(container.textContent).toContain("Management");
    expect(container.textContent).toContain("Intelligence");
    expect(container.textContent).toContain("Time");
    expect(container.textContent).toContain("Interact");
  });

  it("renders all navigation labels in zh-Hant", () => {
    renderSidebar();
    const expectedLabels = [
      "實時監控",
      getTasksPageLabel(),
      "物品",
      "來源",
      "排行榜",
      "情報事件",
      "時間規劃",
      "通知",
      "助手",
      "AI 設定",
      "系統設定",
      "帳戶",
    ];
    for (const label of expectedLabels) {
      expect(container.textContent).toContain(label);
    }
  });

  it("renders English nav labels under en", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    renderSidebar();
    expect(container.textContent).toContain("Intel events");
    expect(container.textContent).toContain("Live Monitor");
    expect(container.textContent).toContain("Tasks");
    expect(container.textContent).toContain("Account");
  });

  it("marks the current route as active", () => {
    mockPathname = "/monitor";
    renderSidebar();
    const active = getLinks().filter(isActiveSidebarLink);
    expect(active.length).toBe(1);
    expect(active[0].getAttribute("href")).toBe("/monitor");
  });

  it("marks 任務設定 active on task sub-routes", () => {
    mockPathname = "/tasks/42/edit";
    renderSidebar();
    const active = getLinks().filter(isActiveSidebarLink);
    expect(active.length).toBe(1);
    expect(active[0].getAttribute("aria-label")).toBe(getTasksPageLabel());
  });

  it("marks bottom entries active by route prefix without highlighting /assistant", () => {
    for (const [pathname, label] of [
      ["/ai/analysis-strategy", "AI 設定"],
      ["/settings/theme", "系統設定"],
      ["/settings/logs", "系統設定"],
      ["/account/identity", "帳戶"],
    ] as const) {
      mockPathname = pathname;
      renderSidebar();
      const active = getLinks().filter(isActiveSidebarLink);
      expect(active.length, pathname).toBe(1);
      expect(active[0].getAttribute("aria-label"), pathname).toBe(label);
    }

    mockPathname = "/assistant";
    renderSidebar();
    const active = getLinks().filter(isActiveSidebarLink);
    expect(active.length).toBe(1);
    expect(active[0].getAttribute("aria-label")).toBe("助手");
  });

  it("restores the last visited tasks sub-route on the 任務設定 link", () => {
    mockPathname = "/tasks/7/edit";
    renderSidebar();

    mockPathname = "/monitor";
    renderSidebar();

    const tasksLink = getLinks().find((a) => a.getAttribute("aria-label") === getTasksPageLabel());
    expect(tasksLink?.getAttribute("href")).toBe("/tasks/7/edit");
  });

  it("switches to history rail and persists rail mode", () => {
    renderSidebar();
    const historyTab = container.querySelector<HTMLButtonElement>(
      "[data-testid='sidebar-rail-history']",
    );
    expect(historyTab).toBeTruthy();
    act(() => {
      historyTab!.click();
    });
    expect(container.querySelector("[data-testid='assistant-history-rail']")).toBeTruthy();
    expect(window.localStorage.getItem(SIDEBAR_RAIL_MODE_KEY)).toBe("history");
    expect(getLinks()).toHaveLength(0);
  });

  it("hides collect/analyze links in simple mode", () => {
    window.localStorage.setItem(SIMPLE_MODE_STORAGE_KEY, "true");
    mockPathname = "/timeline";
    renderSidebar();
    const hrefs = getLinks().map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/tasks",
      "/items",
      "/timeline",
      "/actions",
      "/assistant",
      "/ai/provider",
      "/settings",
      "/account/identity",
    ]);
    expect(hrefs).not.toContain("/monitor");
    expect(hrefs).not.toContain("/sources");
    expect(hrefs).not.toContain("/leaderboard");
    expect(hrefs).toContain("/actions");
    expect(hrefs).toContain("/items");
  });

  it("does not own collapsed localStorage writes from an inline collapse control", () => {
    renderSidebar();
    expect(container.querySelector("[data-testid='sidebar-collapse']")).toBeNull();
    // Hook still applies width from existing key when present.
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "1");
  });
});
