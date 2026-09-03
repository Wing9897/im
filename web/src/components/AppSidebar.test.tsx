import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SIMPLE_MODE_STORAGE_KEY } from "../domain/ui/simpleMode";
import { SimpleModeProvider } from "../context/SimpleModeContext";
import { MONITOR_MODE_KEY, MonitorModeProvider } from "../context/MonitorModeContext";
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
    className?: string | ((state: { isActive: boolean }) => string);
    "aria-current"?: string | boolean;
    "aria-label"?: string;
    title?: string;
    "data-testid"?: string;
  }) =>
    createElement(
      "a",
      {
        href: props.to,
        className:
          typeof props.className === "function"
            ? props.className({ isActive: false })
            : props.className,
        "aria-current": props["aria-current"],
        "aria-label": props["aria-label"],
        title: props.title,
        "data-testid": props["data-testid"] ?? "sidebar-link",
      },
      props.children,
    ),
  useLocation: () => ({ pathname: mockPathname, search: "", hash: "" }),
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

  function mountSidebar() {
    act(() => {
      root.render(
        wrapWithI18n(
          createElement(
            MonitorModeProvider,
            null,
            createElement(SimpleModeProvider, null, createElement(AppSidebar)),
          ),
        ),
      );
    });
  }

  function renderSidebar({ overlayOpen = true }: { overlayOpen?: boolean } = {}) {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, overlayOpen ? "0" : "1");
    mountSidebar();
  }

  function getLinks() {
    return Array.from(
      document.body.querySelectorAll<HTMLAnchorElement>("a[data-testid='sidebar-link']"),
    );
  }

  function edgeToggle() {
    return document.body.querySelector<HTMLButtonElement>(
      "[data-testid='sidebar-edge-toggle']",
    );
  }

  it("defaults to a closed overlay so pages stay full-bleed", () => {
    mountSidebar();
    expect(document.body.querySelector("[data-testid='app-sidebar-overlay']")).toBeNull();
    expect(document.body.querySelector("[data-testid='app-sidebar']")).toBeNull();
    expect(edgeToggle()).toBeTruthy();
    expect(edgeToggle()?.className).toContain("im-sidebar-edge-toggle");
    expect(edgeToggle()?.getAttribute("aria-expanded")).toBe("false");
    expect(edgeToggle()?.getAttribute("aria-label")).toBe("展開側欄");
    expect(edgeToggle()?.hidden).toBe(false);
    expect(edgeToggle()?.getAttribute("aria-hidden")).toBeNull();
    const peek = document.body.querySelector("[data-testid='sidebar-edge-peek']");
    expect(peek).toBeTruthy();
    expect(peek?.className).toContain("im-sidebar-edge-peek");
    expect(peek?.getAttribute("data-collapsed")).toBe("true");
    expect(peek?.contains(edgeToggle())).toBe(true);
    expect(getLinks()).toHaveLength(0);
  });

  it("does not paint wallpaper on the overlay drawer", () => {
    renderSidebar({ overlayOpen: true });
    const overlay = document.body.querySelector("[data-testid='app-sidebar-overlay']");
    const nav = document.body.querySelector("[data-testid='app-sidebar']");
    expect(overlay?.className).toContain("im-sidebar-scrim");
    expect(nav?.className).toContain("im-dialog-drawer");
    expect(nav?.className).toContain("im-material-panel");
    expect(nav?.className).toContain("im-sidebar-panel");
    expect(nav?.className).not.toContain("im-shell-sidebar");
    expect(nav?.className).not.toMatch(/background-image/);
    expect(overlay?.className).not.toMatch(/background-image/);
  });

  it("pairs im-sidebar-panel with im-material-panel frost (not a translucent wash)", () => {
    renderSidebar({ overlayOpen: true });
    const nav = document.body.querySelector("[data-testid='app-sidebar']");
    expect(nav?.className).toContain("im-material-panel");
    expect(nav?.className).toContain("im-sidebar-panel");
    expect(nav?.className).not.toMatch(/opacity-/);
    expect(nav?.className).not.toMatch(/bg-.*\/\d+/);
    expect(nav?.className).not.toMatch(/overflow-/);
    const scrollPane = nav?.querySelector("[data-testid='app-sidebar-nav-scroll']");
    expect(scrollPane?.className).toMatch(/overflow-y-auto/);
  });

  it("does not blur the main canvas when the overlay is open", () => {
    renderSidebar({ overlayOpen: true });
    const overlay = document.body.querySelector("[data-testid='app-sidebar-overlay']");
    const portal = overlay?.parentElement;
    expect(portal?.className).toContain("im-sidebar-overlay");
    expect(portal?.className).toContain("bg-black/10");
    expect(portal?.className).not.toMatch(/backdrop-blur/);
    expect(overlay?.className).toContain("im-sidebar-scrim");
    expect(overlay?.className).not.toMatch(/backdrop-blur/);
    expect(overlay?.className).not.toMatch(/backdrop-filter/);
  });

  it("opens a surface overlay from the edge chevron", () => {
    mountSidebar();
    act(() => {
      edgeToggle()?.click();
    });
    const overlay = document.body.querySelector("[data-testid='app-sidebar-overlay']");
    const nav = document.body.querySelector("[data-testid='app-sidebar']");
    expect(overlay).toBeTruthy();
    expect(nav).toBeTruthy();
    expect(nav?.className).toContain("im-dialog-drawer");
    expect(nav?.className).toContain("im-material-panel");
    expect(nav?.className).toContain("im-sidebar-panel");
    expect(nav?.className).not.toContain("im-shell-sidebar");
    expect(edgeToggle()?.className).toContain("im-sidebar-edge-toggle");
    expect(edgeToggle()?.getAttribute("aria-expanded")).toBe("true");
    expect(edgeToggle()?.getAttribute("aria-label")).toBe("收起側欄");
    expect(document.body.querySelector("[data-testid='sidebar-edge-peek']")).toBeNull();
    expect(edgeToggle()?.closest("[data-testid='sidebar-edge-peek']")).toBeNull();
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("0");
    expect(getLinks().length).toBeGreaterThan(0);
  });

  it("closes the overlay on scrim click and Escape", () => {
    renderSidebar({ overlayOpen: true });
    expect(document.body.querySelector("[data-testid='app-sidebar-overlay']")).toBeTruthy();

    act(() => {
      document.body
        .querySelector<HTMLElement>("[data-testid='app-sidebar-overlay']")
        ?.click();
    });
    expect(document.body.querySelector("[data-testid='app-sidebar-overlay']")).toBeNull();

    act(() => {
      edgeToggle()?.click();
    });
    expect(document.body.querySelector("[data-testid='app-sidebar-overlay']")).toBeTruthy();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.body.querySelector("[data-testid='app-sidebar-overlay']")).toBeNull();
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("1");
    expect(document.body.querySelector("[data-testid='sidebar-edge-peek']")).toBeTruthy();
    expect(edgeToggle()?.closest("[data-testid='sidebar-edge-peek']")).toBeTruthy();
  });

  it("renders 選單/紀錄 mode toggle without logo brand", () => {
    renderSidebar();
    expect(document.body.querySelector("[data-testid='sidebar-rail-nav']")).toBeTruthy();
    expect(document.body.querySelector("[data-testid='sidebar-rail-history']")).toBeTruthy();
    expect(document.body.textContent).toContain("選單");
    expect(document.body.textContent).toContain("紀錄");
    expect(document.body.textContent).not.toMatch(/\bIM\b/);
    expect(document.body.querySelector("[data-testid='sidebar-collapse']")).toBeNull();
    expect(edgeToggle()).toBeTruthy();
  });

  it("renders all navigation links with correct hrefs including 助手", () => {
    renderSidebar();
    const hrefs = getLinks().map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/monitor",
      "/worksets",
      "/tasks",
      "/schedule",
      "/items",
      "/sources",
      "/leaderboard",
      "/intelligence",
      "/timeline",
      "/subscriptions",
      "/notify",
      "/assistant",
      "/settings/ai/provider",
      "/settings",
      "/account/identity",
    ]);
  });

  it("renders visual nav group labels in zh-Hant", () => {
    renderSidebar();
    expect(document.body.textContent).toContain("管理");
    expect(document.body.textContent).toContain("情報");
    expect(document.body.textContent).toContain("時間");
    expect(document.body.textContent).toContain("互動");
    expect(
      document.body.querySelectorAll("[data-testid='sidebar-nav-group']").length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("renders visual nav group labels in en", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    renderSidebar();
    expect(document.body.textContent).toContain("Management");
    expect(document.body.textContent).toContain("Intelligence");
    expect(document.body.textContent).toContain("Time");
    expect(document.body.textContent).toContain("Interact");
  });

  it("renders all navigation labels in zh-Hant", () => {
    renderSidebar();
    const expectedLabels = [
      "實時監控",
      "工作集",
      "任務設定",
      "物品",
      "來源",
      "排行榜",
      "情報事件",
      "時間規劃",
      "訂閱",
      "通知與動作",
      "助手",
      "AI 設定",
      "系統設定",
      "帳戶",
    ];
    for (const label of expectedLabels) {
      expect(document.body.textContent).toContain(label);
    }
  });

  it("renders English nav labels under en", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    renderSidebar();
    expect(document.body.textContent).toContain("Intel events");
    expect(document.body.textContent).toContain("Live Monitor");
    expect(document.body.textContent).toContain("Worksets");
    expect(document.body.textContent).toContain("Tasks");
    expect(document.body.textContent).toContain("Notify & actions");
  });

  it("marks the current route as active", () => {
    mockPathname = "/monitor";
    renderSidebar();
    const active = getLinks().filter(isActiveSidebarLink);
    expect(active.length).toBe(1);
    expect(active[0].getAttribute("href")).toBe("/monitor");
  });

  it("marks 任務設定 active on task editor paths, not 工作集", () => {
    mockPathname = "/tasks/42/edit";
    renderSidebar();
    const active = getLinks().filter(isActiveSidebarLink);
    expect(active).toHaveLength(1);
    expect(active[0].getAttribute("aria-label")).toBe("任務設定");
    expect(active[0].getAttribute("href")).toBe("/tasks");
    const worksets = getLinks().find((link) => link.getAttribute("aria-label") === "工作集");
    expect(worksets?.getAttribute("aria-current")).toBe("false");
  });

  it("sends 任務設定 to the list even while an editor or agent page is open", () => {
    for (const pathname of ["/tasks/42/edit", "/tasks/new", "/tasks/9/agent"] as const) {
      mockPathname = pathname;
      renderSidebar();
      const tasks = getLinks().find((link) => link.getAttribute("aria-label") === "任務設定");
      expect(tasks?.getAttribute("href"), pathname).toBe("/tasks");
    }
  });

  it("marks bottom entries active by route prefix without highlighting /assistant", () => {
    for (const [pathname, label] of [
      ["/settings/ai/provider", "AI 設定"],
      ["/settings/theme", "系統設定"],
      ["/settings/logs", "系統設定"],
      ["/items/finance", "物品"],
      ["/account/identity", "帳戶"],
      ["/account/devices", "帳戶"],
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

  it("does not highlight 系統設定 on /settings/ai", () => {
    mockPathname = "/settings/ai/voice";
    renderSidebar();
    const active = getLinks().filter(isActiveSidebarLink);
    expect(active).toHaveLength(1);
    expect(active[0].getAttribute("aria-label")).toBe("AI 設定");
    expect(active[0].getAttribute("aria-current")).toBe("page");
    const settings = getLinks().find((link) => link.getAttribute("aria-label") === "系統設定");
    expect(settings?.getAttribute("aria-current")).toBe("false");
  });

  it("switches to history rail and persists rail mode", () => {
    renderSidebar();
    const historyTab = document.body.querySelector<HTMLButtonElement>(
      "[data-testid='sidebar-rail-history']",
    );
    expect(historyTab).toBeTruthy();
    act(() => {
      historyTab!.click();
    });
    expect(document.body.querySelector("[data-testid='assistant-history-rail']")).toBeTruthy();
    expect(window.localStorage.getItem(SIDEBAR_RAIL_MODE_KEY)).toBe("history");
    expect(getLinks()).toHaveLength(0);
  });

  it("hides collect/analyze and Tasks links in simple mode", () => {
    window.localStorage.setItem(SIMPLE_MODE_STORAGE_KEY, "true");
    mockPathname = "/timeline";
    renderSidebar();
    const hrefs = getLinks().map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/worksets",
      "/schedule",
      "/items",
      "/timeline",
      "/subscriptions",
      "/notify",
      "/assistant",
      "/settings/ai/provider",
      "/settings",
      "/account/identity",
    ]);
    expect(hrefs).not.toContain("/monitor");
    expect(hrefs).not.toContain("/sources");
    expect(hrefs).not.toContain("/leaderboard");
    expect(hrefs).not.toContain("/tasks");
    expect(hrefs).toContain("/notify");
    expect(hrefs).toContain("/items");
    expect(hrefs).toContain("/schedule");
  });

  it("persists overlay open/closed via the edge chevron, not a layout rail", () => {
    mountSidebar();
    expect(document.body.querySelector("[data-testid='sidebar-collapse']")).toBeNull();
    act(() => {
      edgeToggle()?.click();
    });
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("0");
    expect(document.documentElement.style.getPropertyValue("--app-sidebar-width")).toBe("");
  });

  it("hides the left-edge chevron on ops board (canvas)", () => {
    window.localStorage.setItem(MONITOR_MODE_KEY, "canvas");
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "0");
    mountSidebar();
    expect(document.body.querySelector("[data-testid='sidebar-edge-toggle']")).toBeNull();
    expect(document.body.querySelector("[data-testid='sidebar-edge-peek']")).toBeNull();
    expect(document.body.querySelector("[data-testid='app-sidebar']")).toBeNull();
    expect(document.body.querySelector("[data-testid='app-sidebar-overlay']")).toBeNull();
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("1");
  });
});
