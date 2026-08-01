import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "../i18n";
import { setAppLocale } from "../i18n/locale";
import type { SourceFilterSelection } from "../domain/tasks/sourceFilterSelection";
import { SourceFilterDialog } from "./SourceFilterDialog";

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
  { id: "task-3", name: "Third task", worksetId: null },
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
        createElement(
          I18nextProvider,
          { i18n },
          createElement(SourceFilterDialog, {
            tasks: TASKS,
            worksets: WORKSETS,
            expandTasks: EXPAND_TASKS,
            selection,
            onChange,
            ariaLabelPrefix: "Intelligence",
            variant: "toolbar",
          }),
        ),
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

  it("shows workset rows; unassigned tasks nest under expandable group", () => {
    renderDialog();
    openDialog();
    expect(document.querySelector('[data-testid="board-workset-filter-__user__"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="board-workset-filter-ws-1"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="board-workset-filter-__unassigned__"]')).toBeTruthy();
    // Nested until expanded.
    expect(document.querySelector('[data-testid="board-source-filter-task-3"]')).toBeNull();
    act(() => {
      (
        document.querySelector(
          '[data-testid="board-workset-expand-__unassigned__"]',
        ) as HTMLButtonElement
      ).click();
    });
    expect(document.querySelector('[data-testid="board-source-filter-task-3"]')).toBeTruthy();
  });

  it("expands workset children and allows co-selecting workset + unassigned task", () => {
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
          '[data-testid="board-workset-expand-__unassigned__"]',
        ) as HTMLButtonElement
      ).click();
    });

    act(() => {
      (document.querySelector('[data-testid="board-workset-filter-__user__"]') as HTMLInputElement).click();
      (document.querySelector('[data-testid="board-source-filter-task-3"]') as HTMLInputElement).click();
    });
    act(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const apply = buttons.find((btn) => btn.textContent === "Apply");
      apply?.click();
    });
    expect(onChange).toHaveBeenCalledWith({
      taskIds: ["task-3"],
      worksetIds: ["__user__"],
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
});
