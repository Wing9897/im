/**
 * Smoke test for NotifyWorkspacePage rendering.
 *
 *
 * Verifies that the component renders without throwing exceptions
 * when REST API calls are mocked to return empty/default data.
 * Also verifies error/loading state handling.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
vi.mock("./components/LocalNotifyPanel", () => ({
  LocalNotifyPanel: () => createElement("div", { "data-testid": "local-notify-panel" }),
}));

import { NotifyWorkspacePage } from "./NotifyWorkspacePage";

const NotifyWorkspacePageUnderTest = withRouter(NotifyWorkspacePage);

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("NotifyWorkspacePage smoke test", () => {
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
    await harness.render(NotifyWorkspacePageUnderTest);

    // Component should render the heading
    expect(harness.container.textContent).toContain("通知");
    // Empty state should be shown when no actions exist
    expect(harness.container.textContent).toContain("尚未設定任何通知");
    // The "新增通知" button should be present on the default channels tab
    expect(harness.container.textContent).toContain("新增通知");
    // Workspace tabs separate types / notify / history
    expect(harness.container.textContent).toContain("外發通知");
    expect(harness.container.textContent).not.toContain("語音提醒");
    expect(harness.container.textContent).toContain("觸發紀錄");
  });

  it("does not redirect retired ?tab=voice — unknown tabs stay on types", async () => {
    function VoiceTabGone() {
      return createElement(
        MemoryRouter,
        { initialEntries: ["/notify?tab=voice"] },
        createElement(NotifyWorkspacePage),
      );
    }
    await harness.render(VoiceTabGone);
    expect(harness.container.querySelector('[data-testid="local-notify-panel"]')).toBeNull();
    expect(harness.container.textContent).toContain("外發通知");
  });

  it("does not keep a ?tab=voice redirect in source", () => {
    const src = readFileSync(resolve(__dirname, "./NotifyWorkspacePage.tsx"), "utf8");
    expect(src).not.toContain('tab === "voice"');
    expect(src).not.toContain("tab=voice");
  });

  // Task names come from the shared TaskCatalogContext, so the page itself only
  // owns the actions fetch.
  it("calls listActions on mount", async () => {
    await harness.render(NotifyWorkspacePageUnderTest);

    expect(mockListActions).toHaveBeenCalled();
    expect(mockListTasks).not.toHaveBeenCalled();
  });

  it("shows list skeletons while fetching actions", () => {
    // Keep the list fetch pending so no late state updates escape act().
    mockListActions.mockReturnValue(new Promise(() => {}));

    harness.renderSync(NotifyWorkspacePageUnderTest);

    expect(harness.container.querySelector('[role="status"]')).not.toBeNull();
    expect(harness.container.textContent).not.toContain("載入通知中");
  });

  it("shows an error toast when listActions fails", async () => {
    mockListActions.mockRejectedValue(new Error("Network error"));

    await harness.render(NotifyWorkspacePageUnderTest);

    expect(mockShowToast).toHaveBeenCalledWith("Network error", "error");
    expect(harness.container.textContent).not.toContain("Network error");
  });
});
