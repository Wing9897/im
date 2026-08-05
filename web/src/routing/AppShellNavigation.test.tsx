import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppSidebar } from "../components/AppSidebar";
import { getTasksPageLabel } from "../domain/tasks/taskPageCopy";
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
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderShell(initialPath = "/monitor") {
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
                { className: "flex min-h-0 min-w-0 flex-1 overflow-hidden" },
                createElement(AppSidebar),
                createElement(
                  "main",
                  { className: "im-auto-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto" },
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
            ),
            ),
          ),
        ),
      );
    });
  }

  function clickSidebarLink(label: string) {
    const link = Array.from(
      container.querySelectorAll<HTMLAnchorElement>("a[data-testid='sidebar-link']"),
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

  it("keeps sidebar in document flow (not position:fixed)", () => {
    renderShell("/monitor");
    const sidebar = container.querySelector('nav[aria-label="主導航"]');
    expect(sidebar).toBeTruthy();
    const body = container.querySelector(".flex.min-h-0");
    expect(body?.contains(sidebar)).toBe(true);
    expect(body?.querySelector("main")).toBeTruthy();
  });
});
