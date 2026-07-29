import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VIEWER_TASKS_SELECTED_ID_STORAGE_KEY } from "./viewerPersistedKeys";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../api/viewer", () => ({
  fetchViewerTasks: vi.fn(async () => [
    { id: "task-1", name: "Alpha", isActive: true, lastAnalysisAt: null },
    { id: "task-2", name: "Beta", isActive: false, lastAnalysisAt: null },
  ]),
}));

vi.mock("../../hooks/useDetailPresentation", () => ({
  useDetailPresentation: () => "inline",
}));

vi.mock("../../hooks/useListKeyboardNavigation", () => ({
  useListKeyboardNavigation: vi.fn(),
}));

import { ViewerTasksPage } from "./ViewerTasksPage";

describe("ViewerTasksPage selection persistence", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("restores selected task after remount from localStorage", async () => {
    localStorage.setItem(VIEWER_TASKS_SELECTED_ID_STORAGE_KEY, JSON.stringify("task-2"));

    await act(async () => {
      root.render(createElement(ViewerTasksPage));
      await Promise.resolve();
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(container.querySelector('[aria-label="viewer.viewTaskAria"]')).toBeTruthy();
      });
    });

    const selectedCard = container.querySelector(
      ".border-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_40\\%\\,var\\(--surface-border\\)\\)\\]",
    );
    expect(selectedCard?.textContent).toContain("Beta");

    await act(async () => {
      root.unmount();
    });
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(ViewerTasksPage));
      await Promise.resolve();
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(container.textContent).toContain("Beta");
      });
    });
  });
});
