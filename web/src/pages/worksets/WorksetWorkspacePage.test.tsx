import { act, createElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeAnalysisTask, resetTaskCatalogState, taskCatalogState } from "../../test/context-mocks";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../api/worksets", () => ({
  renameWorkset: vi.fn().mockResolvedValue({}),
  deleteWorkset: vi.fn().mockResolvedValue({ ok: true }),
  updateWorkset: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../api/items", () => ({
  listItems: vi.fn().mockResolvedValue([]),
  listItemCategories: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../api/userEvents", () => ({
  listUserEventsPage: vi.fn().mockResolvedValue({ items: [], totalCount: 0, hasMore: false }),
}));

import { WorksetWorkspacePage } from "./WorksetWorkspacePage";

function WorkspaceAt({ entry }: { entry: string }) {
  return createElement(
    MemoryRouter,
    { initialEntries: [entry] },
    createElement(
      Routes,
      null,
      createElement(Route, {
        path: "/worksets/:worksetId",
        element: createElement(WorksetWorkspacePage),
      }),
    ),
  );
}

describe("WorksetWorkspacePage", () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
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
        externalEnabled: false,
        createdAt: "",
        updatedAt: "",
      },
    ];
    taskCatalogState.tasks = [
      makeAnalysisTask({ id: "t1", name: "Scan", worksetId: "ws-1", outputAnalysisEvents: true }),
    ];
  });

  afterEach(() => {
    harness.cleanup();
  });

  it("shows contents with catalog/graph pills and does not render the old hub Flow tab", async () => {
    await harness.render(WorkspaceAt, { entry: "/worksets/ws-1" });

    expect(harness.container.querySelector('[data-testid="workset-detail-dialog"]')).toBeNull();
    expect(harness.container.querySelector('[data-testid="workset-flow-panel"]')).toBeNull();
    expect(harness.container.querySelector('[data-testid="workset-workspace-tabs"]')).toBeNull();
    expect(harness.container.querySelector('[data-testid="workset-contents-panel"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-catalog-tabs"]')).toBeTruthy();
    expect(harness.container.textContent).toContain("目錄");
    expect(harness.container.textContent).toContain("流程圖");
    expect(harness.container.textContent).toContain("Ops");
    expect(harness.container.textContent).toContain("Scan");
  });

  it("keeps contents when a leftover ?tab=flow query is present", async () => {
    await harness.render(WorkspaceAt, { entry: "/worksets/ws-1?tab=flow" });

    expect(harness.container.querySelector('[data-testid="workset-contents-panel"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-flow-panel"]')).toBeNull();
  });

  it("hides rename and delete for the built-in General workset", async () => {
    await harness.render(WorkspaceAt, { entry: "/worksets/__general__" });

    expect(harness.container.querySelector('[data-testid="workset-workspace-rename"]')).toBeNull();
    expect(harness.container.querySelector('[data-testid="workset-workspace-delete"]')).toBeNull();
    expect(harness.container.textContent).toContain("一般");
    expect(harness.container.textContent).toContain("內建");
  });
});
