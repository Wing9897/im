import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TFunction } from "i18next";

import { resetTaskCatalogState, taskCatalogState } from "../../../test/context-mocks";
import { ensureZhHantLocale, i18n } from "../../../test/i18nHarness";
import { DashboardViewerToolbar } from "./DashboardViewerToolbar";

vi.mock("../../../context/TaskCatalogContext", async () =>
  (await import("../../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../../context/SimpleModeContext", () => ({
  useSimpleMode: () => ({ simpleMode: false, setSimpleMode: vi.fn() }),
}));

function renderToolbar(
  overrides: Partial<Parameters<typeof DashboardViewerToolbar>[0]> = {},
  entry = "/worksets",
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [entry] },
        createElement(DashboardViewerToolbar, {
          t: i18n.t.bind(i18n) as TFunction,
          isWorksetView: false,
          modeFilter: "all",
          taskCount: 2,
          searchQuery: "",
          showSystemTasks: false,
          createTaskLabel: "新增任務",
          showSystemTasksLabel: "顯示系統任務",
          hideSystemTasksLabel: "隱藏系統任務",
          onModeFilterChange: vi.fn(),
          onSearchQueryChange: vi.fn(),
          onToggleSystemTasks: vi.fn(),
            onCreateTask: vi.fn(),
            onCreateWorkset: vi.fn(),
            onOpenScheduling: vi.fn(),
            ...overrides,
        }),
      ),
    );
  });
  return { container, root };
}

describe("DashboardViewerToolbar", () => {
  const mounts: { container: HTMLDivElement; root: Root }[] = [];

  beforeEach(async () => {
    await ensureZhHantLocale();
    resetTaskCatalogState();
    taskCatalogState.worksets = [
      {
        id: "__general__",
        name: "一般",
        isSystem: true,
        notifyEnabled: true,
        externalEnabled: true,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "ws-1",
        name: "Ops",
        isSystem: false,
        notifyEnabled: true,
        externalEnabled: true,
        createdAt: "",
        updatedAt: "",
      },
    ];
  });

  afterEach(() => {
    for (const mount of mounts.splice(0)) {
      act(() => {
        mount.root.unmount();
      });
      mount.container.remove();
    }
  });

  function track(
    overrides: Partial<Parameters<typeof DashboardViewerToolbar>[0]> = {},
    entry = "/worksets",
  ) {
    const mount = renderToolbar(overrides, entry);
    mounts.push(mount);
    return mount.container;
  }

  it("puts a visible search TextField in the tasks catalog OpsControlBar", () => {
    const container = track({ isWorksetView: false, taskCount: 3 }, "/tasks");

    const toolbar = container.querySelector('[data-testid="tasks-toolbar"]') as HTMLElement;
    expect(toolbar).not.toBeNull();
    expect(toolbar.getAttribute("role")).toBe("toolbar");
    expect(toolbar.className).toContain("im-control-bar");

    const search = toolbar.querySelector('[data-testid="tasks-search"]') as HTMLInputElement;
    expect(search).toBeInstanceOf(HTMLInputElement);
    expect(search.tagName).toBe("INPUT");
    expect(search.getAttribute("data-im-search")).not.toBeNull();
    expect(search.placeholder).toBe("搜尋任務…");
    expect(search.getAttribute("aria-label")).toBe("搜尋任務");
    expect(search.className.split(/\s+/)).not.toContain("hidden");
    expect(search.getAttribute("hidden")).toBeNull();
    expect(search.getAttribute("aria-hidden")).not.toBe("true");
    expect(search.className).toContain("shrink-0");
    expect(search.className).toContain("im-page-ops-ctrl");

    const actions = search.parentElement;
    expect(actions).not.toBeNull();
    expect(actions!.querySelector('[data-testid="toggle-system-tasks"]')).not.toBeNull();
    expect(actions!.querySelector('[data-testid="open-global-scheduling"]')).not.toBeNull();
    expect(actions!.textContent).toContain("新增任務");
    expect(toolbar.querySelector('[data-testid="workset-catalog-tabs"]')).toBeNull();
    expect(toolbar.textContent).not.toContain("目錄");
    expect(toolbar.textContent).not.toContain("流程圖");
  });

  it("keeps the tasks search field in the toolbar when the catalog is empty", () => {
    const container = track({ isWorksetView: false, taskCount: 0 }, "/tasks");

    const toolbar = container.querySelector('[data-testid="tasks-toolbar"]') as HTMLElement;
    const search = toolbar.querySelector('[data-testid="tasks-search"]');
    expect(search).toBeInstanceOf(HTMLInputElement);
    expect(toolbar.querySelector('[data-testid="toggle-system-tasks"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-testid="open-global-scheduling"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-testid="workset-catalog-tabs"]')).toBeNull();
    expect(toolbar.textContent).not.toContain("流程圖");
  });

  it("keeps workset search in the worksets catalog toolbar", () => {
    const container = track({ isWorksetView: true, taskCount: 0 });

    const toolbar = container.querySelector('[data-testid="worksets-toolbar"]') as HTMLElement;
    expect(toolbar).not.toBeNull();
    const search = toolbar.querySelector('[data-testid="worksets-search"]') as HTMLInputElement;
    expect(search).toBeInstanceOf(HTMLInputElement);
    expect(search.placeholder).toBe("搜尋工作集…");
    expect(toolbar.querySelector('[data-testid="tasks-search"]')).toBeNull();
    expect(toolbar.querySelector('[data-testid="open-global-scheduling"]')).toBeNull();
    expect(toolbar.querySelector('[data-testid="dashboard-create-workset"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-testid="workset-catalog-tabs"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-testid="workset-graph-filter"]')).toBeNull();
    expect(toolbar.textContent).toContain("目錄");
    expect(toolbar.textContent).toContain("流程圖");
    expect(toolbar.textContent).not.toContain("任務");
  });

  it("hides workset search and create when hideSearch and hideCreateWorkset are set", () => {
    const container = track({
      isWorksetView: true,
      taskCount: 0,
      hideSearch: true,
      hideCreateWorkset: true,
    });

    const toolbar = container.querySelector('[data-testid="worksets-toolbar"]') as HTMLElement;
    expect(toolbar.querySelector('[data-testid="worksets-search"]')).toBeNull();
    expect(toolbar.querySelector('[data-testid="dashboard-create-workset"]')).toBeNull();
    expect(toolbar.querySelector('[data-testid="workset-catalog-tabs"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-testid="workset-graph-filter"]')).toBeNull();
  });

  it("shows a workset checkbox filter next to catalog/graph pills on the graph tab", () => {
    const container = track(
      {
        isWorksetView: true,
        taskCount: 0,
        hideSearch: true,
        hideCreateWorkset: true,
      },
      "/worksets?tab=graph",
    );

    const toolbar = container.querySelector('[data-testid="worksets-toolbar"]') as HTMLElement;
    const filter = toolbar.querySelector('[data-testid="workset-graph-filter"]');
    const trigger = toolbar.querySelector('[data-testid="workset-graph-filter-value"]');
    expect(filter).not.toBeNull();
    expect(toolbar.querySelector('[data-testid="workset-catalog-tabs"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-testid="workset-graph-filter-all"]')).toBeNull();
    expect(filter?.querySelectorAll("button[aria-pressed]")).toHaveLength(0);
    expect(trigger?.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger?.textContent).toContain("2/2");
  });

  it("shows the global scheduling icon only on the tasks toolbar", () => {
    const tasks = track({ isWorksetView: false, taskCount: 2 }, "/tasks");
    const scheduling = tasks.querySelector(
      '[data-testid="open-global-scheduling"]',
    ) as HTMLButtonElement;
    expect(scheduling).not.toBeNull();
    expect(scheduling.getAttribute("aria-label")).toBe("全局調度設定");
    expect(tasks.querySelector('[data-testid="workset-catalog-tabs"]')).toBeNull();
    expect(tasks.textContent).not.toContain("流程圖");

    const worksets = track({ isWorksetView: true, taskCount: 0 }, "/worksets");
    expect(worksets.querySelector('[data-testid="open-global-scheduling"]')).toBeNull();
  });
});
