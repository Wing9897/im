import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SourceFilterSelection } from "../domain/tasks/sourceFilterSelection";
import { SourceFilterDialog } from "./SourceFilterDialog";
import { i18n, wrapWithI18n } from "../test/i18nHarness";
import { setAppLocale } from "../i18n/locale";

const TASKS = [
  { id: "task-1", name: "First task" },
  { id: "task-2", name: "Second task" },
  { id: "task-3", name: "Third task" },
];

const WORKSETS = [
  { id: "__user__", name: "General" },
  { id: "ws-1", name: "Ops" },
];

const EXPAND_TASKS = [
  { id: "task-1", name: "First task", worksetId: "ws-1" },
  { id: "task-2", name: "Second task", worksetId: "ws-1" },
  { id: "task-3", name: "Third task", worksetId: "__user__" },
];

describe("SourceFilterDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.querySelectorAll('[data-testid="source-filter-dialog"]').forEach((node) => node.remove());
  });

  function renderDialog(selection: SourceFilterSelection = null) {
    const onChange = vi.fn();
    act(() => {
      root.render(
        wrapWithI18n(createElement(SourceFilterDialog, {
            tasks: TASKS,
            worksets: WORKSETS,
            expandTasks: EXPAND_TASKS,
            selection,
            onChange,
            ariaLabelPrefix: "Intelligence",
            variant: "toolbar",
          })),
      );
    });
    return onChange;
  }

  function openDialog() {
    const trigger = container.querySelector(
      '[data-testid="board-source-filter"]',
    ) as HTMLButtonElement;
    act(() => {
      trigger.click();
    });
    return trigger;
  }

  it("opens the modal dialog from the trigger button", () => {
    renderDialog();
    openDialog();
    expect(document.querySelector('[data-testid="source-filter-dialog"]')).toBeTruthy();
  });

  it("shows workset rows; 一般 members nest under expandable group", () => {
    renderDialog();
    openDialog();
    expect(document.querySelector('[data-testid="board-workset-filter-__user__"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="board-workset-filter-ws-1"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="board-workset-filter-__unassigned__"]')).toBeNull();
    expect(document.querySelector('[data-testid="board-source-filter-task-3"]')).toBeNull();
    act(() => {
      (
        document.querySelector(
          '[data-testid="board-workset-expand-__user__"]',
        ) as HTMLButtonElement
      ).click();
    });
    expect(document.querySelector('[data-testid="board-source-filter-task-3"]')).toBeTruthy();
  });

  it("expands workset children and allows co-selecting a workset plus a 一般 task", () => {
    const onChange = renderDialog({ taskIds: [], worksetIds: [] });
    openDialog();
    const expand = document.querySelector(
      '[data-testid="board-workset-expand-ws-1"]',
    ) as HTMLButtonElement;
    act(() => {
      expand.click();
    });
    expect(document.querySelector('[data-testid="board-source-filter-task-1"]')).toBeTruthy();

    act(() => {
      (
        document.querySelector(
          '[data-testid="board-workset-expand-__user__"]',
        ) as HTMLButtonElement
      ).click();
    });

    act(() => {
      (document.querySelector('[data-testid="board-workset-filter-ws-1"]') as HTMLInputElement).click();
      (document.querySelector('[data-testid="board-source-filter-task-3"]') as HTMLInputElement).click();
    });
    act(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const apply = buttons.find((btn) => btn.textContent === "Apply");
      apply?.click();
    });
    expect(onChange).toHaveBeenCalledWith({
      taskIds: ["task-3"],
      worksetIds: ["ws-1"],
    });
  });

  it("select all collapses to null", () => {
    const onChange = renderDialog({ taskIds: ["task-3"], worksetIds: [] });
    openDialog();
    act(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const selectAll = buttons.find((btn) => btn.textContent === "Select all");
      selectAll?.click();
    });
    act(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const apply = buttons.find((btn) => btn.textContent === "Apply");
      apply?.click();
    });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("merges catalog titles when expandTasks omit name; never shows bare hex ids", () => {
    const hex = "2049aa3c7fa64c01b19c45ad336cc7be";
    act(() => {
      root.render(
        wrapWithI18n(createElement(SourceFilterDialog, {
            tasks: [
              { id: hex, name: "Alpha briefing" },
              { id: "task-empty", name: "" },
            ],
            worksets: WORKSETS,
            expandTasks: [
              { id: hex, worksetId: null },
              { id: "task-empty", worksetId: null, analysisMode: "agent" },
            ],
            selection: null,
            onChange: vi.fn(),
            ariaLabelPrefix: "Timeline",
            variant: "toolbar",
          })),
      );
    });
    openDialog();
    const dialog = document.querySelector('[data-testid="source-filter-dialog"]')!;
    const expandGeneral = document.querySelector(
      '[data-testid="board-workset-expand-__user__"]',
    ) as HTMLButtonElement | null;
    expect(expandGeneral).toBeTruthy();
    // Hint uses ▸ (not legacy ▶ / word "chevron"); jsdom may normalize glyph text.
    expect(dialog.textContent).not.toContain("▶");
    act(() => {
      expandGeneral!.click();
    });
    const labeled = document.querySelector(`[data-testid="board-source-filter-${hex}"]`)!
      .closest("label")!;
    expect(labeled.textContent).toContain("Alpha briefing");
    expect(labeled.textContent).not.toContain(hex);

    const emptyRow = document
      .querySelector('[data-testid="board-source-filter-task-empty"]')!
      .closest("label")!;
    expect(emptyRow.textContent).toContain("Unnamed task");
    expect(emptyRow.textContent).not.toContain("task-empty");
    expect(
      document.querySelector('[data-testid="source-filter-mode-task-empty"]'),
    ).toBeTruthy();
  });

  it("filters the tree by task title, not only id", () => {
    renderDialog();
    openDialog();
    const search = document.querySelector(
      '[data-testid="source-filter-dialog-search"]',
    ) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(search, "Third");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(document.querySelector('[data-testid="board-source-filter-task-3"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="board-source-filter-task-1"]')).toBeNull();
    expect(document.querySelector('[data-testid="board-workset-filter-ws-1"]')).toBeNull();
    expect(
      document.querySelector('[data-testid="board-workset-filter-__user__"]'),
    ).toBeTruthy();
  });

  it("searching by workset name keeps member tasks visible", () => {
    renderDialog();
    openDialog();
    const search = document.querySelector(
      '[data-testid="source-filter-dialog-search"]',
    ) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(search, "Ops");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(document.querySelector('[data-testid="board-workset-filter-ws-1"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="board-source-filter-task-1"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="board-source-filter-task-2"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="board-workset-filter-__user__"]')).toBeNull();
  });

  it("task-only coverage of all members leaves workset indeterminate until promoted", () => {
    const onChange = renderDialog({ taskIds: [], worksetIds: [] });
    openDialog();
    act(() => {
      (
        document.querySelector(
          '[data-testid="board-workset-expand-ws-1"]',
        ) as HTMLButtonElement
      ).click();
    });
    act(() => {
      (document.querySelector('[data-testid="board-source-filter-task-1"]') as HTMLInputElement).click();
      (document.querySelector('[data-testid="board-source-filter-task-2"]') as HTMLInputElement).click();
    });
    const wsCheckbox = document.querySelector(
      '[data-testid="board-workset-filter-ws-1"]',
    ) as HTMLInputElement;
    expect(wsCheckbox.checked).toBe(false);
    expect(wsCheckbox.indeterminate).toBe(true);

    act(() => {
      wsCheckbox.click();
    });
    act(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const apply = buttons.find((btn) => btn.textContent === "Apply");
      apply?.click();
    });
    expect(onChange).toHaveBeenCalledWith({
      taskIds: [],
      worksetIds: ["ws-1"],
    });
  });

  it("lists agent tasks with mode label and allows selecting them", () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        wrapWithI18n(createElement(SourceFilterDialog, {
            tasks: [{ id: "web-1", name: "Pricing watch" }],
            worksets: WORKSETS,
            expandTasks: [
              {
                id: "web-1",
                name: "Pricing watch",
                worksetId: "ws-1",
                analysisMode: "agent",
              },
            ],
            selection: { taskIds: [], worksetIds: [] },
            onChange,
            ariaLabelPrefix: "Intelligence",
            variant: "toolbar",
          })),
      );
    });
    openDialog();
    act(() => {
      (
        document.querySelector(
          '[data-testid="board-workset-expand-ws-1"]',
        ) as HTMLButtonElement
      ).click();
    });

    const row = document
      .querySelector('[data-testid="board-source-filter-web-1"]')!
      .closest("label")!;
    expect(row.textContent).toContain("Pricing watch");
    // Agent-mode tasks are labeled "Project Manager task" since the staff-class rename.
    expect(row.textContent).toMatch(/Project Manager/i);

    act(() => {
      (document.querySelector('[data-testid="board-source-filter-web-1"]') as HTMLInputElement).click();
    });
    act(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const apply = buttons.find((btn) => btn.textContent === "Apply");
      apply?.click();
    });
    expect(onChange).toHaveBeenCalledWith({
      taskIds: ["web-1"],
      worksetIds: [],
    });
  });
});
