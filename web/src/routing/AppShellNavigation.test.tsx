import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppSidebar } from "../components/AppSidebar";
import { getTasksPageLabel } from "../domain/tasks/taskPageCopy";
import { SIDEBAR_COLLAPSED_KEY } from "../hooks/useSidebarCollapsed";
import {
  AnalysisStatusProvider,
  type AnalysisStatusContextValue,
} from "../context/AnalysisStatusContext";
import { SimpleModeProvider } from "../context/SimpleModeContext";

function PathnameProbe() {
  const { pathname } = useLocation();
  return createElement("div", { "data-testid": "pathname" }, pathname);
}

function StubPage({ label }: { label: string }) {
  return createElement("div", { "data-testid": `stub-page-${label}` }, label);
}

const stubAnalysisValue: AnalysisStatusContextValue = {
  queueStatus: null,
  analysisPaused: false,
  activeAnalyses: new Map(),
  lastAnalysisEvent: null,
  lastSourceStatusChange: null,
  lastMessagesUpdate: null,
  requestQueueStatusRefresh: () => {},
};

describe("App shell navigation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.localStorage.clear();
  });

  function renderShell(initialPath = "/monitor", { overlayOpen = true } = {}) {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, overlayOpen ? "0" : "1");
    act(() => {
      root.render(
        createElement(
          MemoryRouter,
          {
            initialEntries: [initialPath],
            future: { v7_startTransition: true, v7_relativeSplatPath: true },
          },
          createElement(
            AnalysisStatusProvider,
            { value: stubAnalysisValue },
            createElement(
              SimpleModeProvider,
              null,
              createElement(
                "div",
                {
                  className: "flex min-h-0 min-w-0 flex-1 overflow-hidden",
                  "data-testid": "shell-body",
                },
                createElement(
                  "main",
                  {
                    className:
                      "im-auto-scrollbar im-page-canvas flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-y-auto",
                    "data-testid": "app-shell-page-canvas",
                  },
                  createElement(PathnameProbe),
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/monitor",
                      element: createElement(StubPage, { label: "monitor" }),
                    }),
                    createElement(Route, {
                      path: "/tasks/*",
                      element: createElement(StubPage, { label: "tasks" }),
                    }),
                    createElement(Route, {
                      path: "/intelligence",
                      element: createElement(StubPage, { label: "intelligence" }),
                    }),
                    createElement(Route, {
                      path: "/sources",
                      element: createElement(StubPage, { label: "sources" }),
                    }),
                    createElement(Route, {
                      path: "/ai/*",
                      element: createElement(StubPage, { label: "ai" }),
                    }),
                  ),
                ),
                createElement(AppSidebar),
              ),
            ),
          ),
        ),
      );
    });
  }

  function clickSidebarLink(label: string) {
    const link = Array.from(
      document.body.querySelectorAll<HTMLAnchorElement>("a[data-testid='sidebar-link']"),
    ).find((a) => a.getAttribute("aria-label") === label);
    expect(link, `missing sidebar link: ${label}`).toBeTruthy();
    act(() => {
      link!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
  }

  it("updates pathname and page content when sidebar links are clicked", () => {
    renderShell("/monitor");

    expect(container.querySelector("[data-testid='pathname']")?.textContent).toBe("/monitor");
    expect(container.querySelector("[data-testid='stub-page-monitor']")).toBeTruthy();

    clickSidebarLink(getTasksPageLabel());
    expect(container.querySelector("[data-testid='pathname']")?.textContent).toBe("/tasks");
    expect(container.querySelector("[data-testid='stub-page-tasks']")).toBeTruthy();

    clickSidebarLink("情報事件");
    expect(container.querySelector("[data-testid='pathname']")?.textContent).toBe(
      "/intelligence",
    );
    expect(container.querySelector("[data-testid='stub-page-intelligence']")).toBeTruthy();

    clickSidebarLink("來源");
    expect(container.querySelector("[data-testid='pathname']")?.textContent).toBe("/sources");
    expect(container.querySelector("[data-testid='stub-page-sources']")).toBeTruthy();

    clickSidebarLink("AI 設定");
    expect(container.querySelector("[data-testid='pathname']")?.textContent).toBe("/ai/provider");
    expect(container.querySelector("[data-testid='stub-page-ai']")).toBeTruthy();
  });

  it("keeps page content full-bleed when the overlay is closed", () => {
    renderShell("/monitor", { overlayOpen: false });
    const body = container.querySelector("[data-testid='shell-body']");
    const canvas = container.querySelector("[data-testid='app-shell-page-canvas']");
    expect(body?.contains(canvas)).toBe(true);
    expect(body?.querySelector("nav")).toBeNull();
    expect(document.body.querySelector("[data-testid='app-sidebar-overlay']")).toBeNull();
    expect(canvas?.className).toContain("w-full");
    expect(canvas?.className).toContain("flex-1");
  });

  it("opens the nav overlay from the left-edge chevron", () => {
    renderShell("/monitor", { overlayOpen: false });
    const chevron = document.body.querySelector<HTMLButtonElement>(
      "[data-testid='sidebar-edge-toggle']",
    );
    expect(chevron).toBeTruthy();
    act(() => {
      chevron!.click();
    });
    const overlay = document.body.querySelector("[data-testid='app-sidebar-overlay']");
    const nav = document.body.querySelector("[data-testid='app-sidebar']");
    expect(overlay).toBeTruthy();
    expect(nav).toBeTruthy();
    expect(nav?.className).toContain("im-dialog-drawer");
    expect(nav?.className).toContain("im-material-panel");
    expect(nav?.className).toContain("im-sidebar-panel");
    expect(nav?.className).not.toContain("im-shell-sidebar");
    expect(nav?.className).not.toMatch(/background-image/);
    expect(overlay?.className).not.toMatch(/backdrop-blur/);
    expect(overlay?.parentElement?.className).not.toMatch(/backdrop-blur/);
    expect(container.querySelector("[data-testid='app-shell-page-canvas']")?.className).not.toMatch(
      /backdrop-blur/,
    );
    expect(document.body.contains(nav)).toBe(true);
    expect(container.querySelector("[data-testid='shell-body']")?.contains(nav)).toBe(false);
  });

  it("keeps sidebar overlay out of page layout (portal, not a flex column)", () => {
    renderShell("/monitor");
    const sidebar = document.body.querySelector('nav[aria-label="主導航"]');
    expect(sidebar).toBeTruthy();
    const body = container.querySelector("[data-testid='shell-body']");
    expect(body?.contains(sidebar)).toBe(false);
    expect(body?.querySelector("main")).toBeTruthy();
  });
});
