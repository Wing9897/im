/**
 * Viewer shell rendering: layout nav + remote top-bar affordances.
 * Page loading / selection behavior lives in ViewerTasksPage.test.tsx.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";

vi.mock("react-router-dom", () => ({
  NavLink: (props: { to: string; children: React.ReactNode; style?: unknown }) =>
    createElement("a", { href: props.to, "data-testid": "viewer-navlink" }, props.children),
  Outlet: () => createElement("div", { "data-testid": "outlet" }, "outlet-content"),
  useLocation: () => ({ pathname: "/monitor" }),
  Link: (props: { to: string; children: React.ReactNode; style?: unknown; [key: string]: unknown }) =>
    createElement(
      "a",
      {
        href: props.to,
        style: props.style,
        "data-testid": props["data-testid"] ?? "dropdown-link",
        "aria-label": props["aria-label"],
        className: props.className,
      },
      props.children,
    ),
}));

vi.mock("../../api/client", () => ({
  ApiRequestError: class ApiRequestError extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.status = status;
    }
  },
}));

let mockAccessContext: "local" | "remote" = "local";

vi.mock("../../utils/accessContext", () => ({
  detectAccessContext: () => mockAccessContext,
  useAccessContext: () => mockAccessContext,
}));

vi.mock("../../context/CollectorStatusContext", () => ({
  useCollectorStatus: () => ({
    collectorStatus: "running" as const,
    aiEngineStatus: "available" as const,
    requestAiStatusRefresh: () => {},
  }),
}));

vi.mock("../../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => ({
    analysisPaused: false,
    activeAnalysis: null,
    activeAnalyses: new Map(),
  }),
}));

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../hooks/useCommandPalette", () => ({
  useCommandPalette: () => ({
    open: false,
    query: "",
    setQuery: vi.fn(),
    filtered: [],
    openPalette: vi.fn(),
    closePalette: vi.fn(),
    runItem: vi.fn(),
  }),
}));

vi.mock("../../hooks/useAssistantQuick", () => ({
  useAssistantQuick: () => ({
    captionActive: true,
    composerOpen: false,
    editableFocused: false,
    voiceLive: true,
    captionListening: false,
    openCaption: vi.fn(),
    closeCaption: vi.fn(),
    openComposer: vi.fn(),
    closeComposer: vi.fn(),
    toggleComposer: vi.fn(),
    setCaptionListening: vi.fn(),
    chatActions: null,
    registerChatActions: vi.fn(),
  }),
}));

vi.mock("../../context/MonitorModeContext", () => ({
  MonitorModeProvider: ({ children }: { children: React.ReactNode }) => children,
  useMonitorMode: () => ({
    monitorMode: "pages" as const,
    setMonitorMode: vi.fn(),
    openInPages: vi.fn(),
  }),
}));

const { ViewerLayout } = await import("./ViewerLayout");
const { AppTopBar } = await import("../../components/AppTopBar");

describe("ViewerLayout", () => {
  let container: HTMLDivElement;

  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("renders navigation links for tasks, results, and status", () => {
    act(() => {
      createRoot(container).render(createElement(I18nextProvider, { i18n }, createElement(ViewerLayout)));
    });

    const links = container.querySelectorAll<HTMLAnchorElement>("a[data-testid='viewer-navlink']");
    expect(links.length).toBe(3);

    const hrefs = Array.from(links).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/viewer/tasks");
    expect(hrefs).toContain("/viewer/results");
    expect(hrefs).toContain("/viewer/status");
  });

  it("renders navigation labels in Chinese", () => {
    act(() => {
      createRoot(container).render(createElement(I18nextProvider, { i18n }, createElement(ViewerLayout)));
    });

    expect(container.textContent).toContain("任務");
    expect(container.textContent).toContain("結果");
    expect(container.textContent).toContain("狀態");
  });

  it("renders the brand name", () => {
    act(() => {
      createRoot(container).render(createElement(I18nextProvider, { i18n }, createElement(ViewerLayout)));
    });

    expect(container.textContent).toContain("IM Viewer");
  });
});

describe("Write UI hidden when access context is remote", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    mockAccessContext = "remote";
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    mockAccessContext = "local";
    document.body.removeChild(container);
  });

  it("renders the top bar actions even when remote", () => {
    act(() => {
      createRoot(container).render(createElement(I18nextProvider, { i18n }, createElement(AppTopBar)));
    });

    const iconArea = container.querySelector("[data-testid='topbar-icon-actions']");
    expect(iconArea).not.toBeNull();

    expect(container.querySelector("[data-testid='open-viewer-btn']")).not.toBeNull();
  });

  it("still renders status indicators and navigation when remote", () => {
    act(() => {
      createRoot(container).render(createElement(I18nextProvider, { i18n }, createElement(AppTopBar)));
    });

    expect(container.querySelector("[data-testid='topbar-status-area']")).not.toBeNull();
    expect(container.textContent).toContain("Intelligence Monitor");
  });
});
