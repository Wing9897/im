/**
 * Smoke test for ActionsPage rendering.
 *
 * Validates: Requirements 13.2, 13.3, 13.4
 *
 * Verifies that the component renders without throwing exceptions
 * when REST API calls are mocked to return empty/default data.
 * Also verifies error/loading state handling.
 */
import { createElement, type ComponentType } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestHarness,
  type TestHarness,
} from "../../test/render-helpers";
import { mockShowToast } from "../../test/context-mocks";

function withRouter<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  return function Routed(props: P) {
    return createElement(MemoryRouter, null, createElement(Component, props));
  };
}

/* ------------------------------------------------------------------ */
/*  Hoisted mocks                                                      */
/* ------------------------------------------------------------------ */

// Mock REST API modules used by the Actions page.
const { mockListActions, mockListTasks } = vi.hoisted(() => ({
  mockListActions: vi.fn(),
  mockListTasks: vi.fn(),
}));

vi.mock("../../api/actions", () => ({
  listActions: mockListActions,
  listActionTriggerHistory: vi.fn().mockResolvedValue({ items: [], totalCount: 0, hasMore: false }),
  deleteAction: vi.fn().mockResolvedValue(undefined),
  toggleAction: vi.fn().mockResolvedValue(undefined),
  testAction: vi.fn().mockResolvedValue({ success: true }),
  createAction: vi.fn().mockResolvedValue(null),
  updateAction: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../api/tasks", () => ({
  listTasks: mockListTasks,
  listTaskTemplatePresets: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));
vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());
vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

import { ActionsPage } from "./ActionsPage";

const ActionsPageUnderTest = withRouter(ActionsPage);

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("ActionsPage smoke test", () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
    mockListActions.mockReset();
    mockListTasks.mockReset();
    mockShowToast.mockReset();
    mockListActions.mockResolvedValue([]);
    mockListTasks.mockResolvedValue([]);
  });

  afterEach(() => {
    harness.cleanup();
  });

  it("renders the empty state without throwing", async () => {
    await harness.render(ActionsPageUnderTest);

    // Component should render the heading
    expect(harness.container.textContent).toContain("通知");
    // Empty state should be shown when no actions exist
    expect(harness.container.textContent).toContain("尚未設定任何通知");
    // The "新增通知" button should be present on the default channels tab
    expect(harness.container.textContent).toContain("新增通知");
    // Workspace tabs separate channels / voice / history
    expect(harness.container.textContent).toContain("外發通知");
    expect(harness.container.textContent).toContain("語音提醒");
    expect(harness.container.textContent).toContain("觸發紀錄");
  });

  // Task names come from the shared TaskCatalogContext, so the page itself only
  // owns the actions fetch.
  it("calls listActions on mount", async () => {
    await harness.render(ActionsPageUnderTest);

    expect(mockListActions).toHaveBeenCalled();
    expect(mockListTasks).not.toHaveBeenCalled();
  });

  it("shows list skeletons while fetching actions", () => {
    // Keep the list fetch pending so no late state updates escape act().
    mockListActions.mockReturnValue(new Promise(() => {}));

    harness.renderSync(ActionsPageUnderTest);

    expect(harness.container.querySelector('[role="status"]')).not.toBeNull();
    expect(harness.container.textContent).not.toContain("載入通知中");
  });

  it("shows an error toast when listActions fails", async () => {
    mockListActions.mockRejectedValue(new Error("Network error"));

    await harness.render(ActionsPageUnderTest);

    expect(mockShowToast).toHaveBeenCalledWith("Network error", "error");
    expect(harness.container.textContent).not.toContain("Network error");
  });
});
