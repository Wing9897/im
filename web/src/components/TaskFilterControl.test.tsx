import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "../i18n";
import { setAppLocale } from "../i18n/locale";
import { TaskFilterControl } from "./TaskFilterControl";

describe("TaskFilterControl", () => {
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
    document
      .querySelectorAll('[data-testid="board-task-filter-menu"]')
      .forEach((node) => node.remove());
  });

  function renderControl(selectedTaskIds: string[] | null = null) {
    const onChange = vi.fn();
    act(() => {
      root.render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(TaskFilterControl, {
            tasks: [
              { id: "task-1", name: "First task" },
              { id: "task-2", name: "Second task" },
            ],
            selectedTaskIds,
            onChange,
            ariaLabelPrefix: "Timeline",
            variant: "toolbar",
          }),
        ),
      );
    });
    return onChange;
  }

  it("opens an accessible portaled checklist and focuses its first option", () => {
    renderControl();
    const trigger = container.querySelector(
      '[data-testid="board-task-filter"]',
    ) as HTMLButtonElement;

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-pressed")).toBe("false");
    act(() => {
      trigger.click();
    });

    const menu = document.querySelector(
      '[data-testid="board-task-filter-menu"]',
    ) as HTMLDivElement;
    const firstTask = document.querySelector(
      '[data-testid="board-task-filter-task-1"]',
    ) as HTMLInputElement;
    expect(menu.parentElement).toBe(document.body);
    expect(menu.getAttribute("role")).toBe("dialog");
    expect(menu.getAttribute("aria-modal")).toBe("true");
    expect(menu.getAttribute("aria-labelledby")).toBeTruthy();
    expect(
      document.getElementById(menu.getAttribute("aria-labelledby")!)?.textContent,
    ).toContain("Select tasks");
    expect(trigger.getAttribute("aria-controls")).toBe(menu.id);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-pressed")).toBe("false");
    expect(document.activeElement).toBe(firstTask);
  });

  it("keeps filtering state separate and returns focus after Escape", () => {
    renderControl(["task-1"]);
    const trigger = container.querySelector(
      '[data-testid="board-task-filter"]',
    ) as HTMLButtonElement;

    expect(trigger.getAttribute("aria-pressed")).toBe("true");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    act(() => {
      trigger.click();
    });
    expect(trigger.getAttribute("aria-pressed")).toBe("true");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    act(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(document.querySelector('[data-testid="board-task-filter-menu"]')).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(trigger);
  });

  it("preserves task selection behavior", () => {
    const onChange = renderControl();
    const trigger = container.querySelector(
      '[data-testid="board-task-filter"]',
    ) as HTMLButtonElement;
    act(() => {
      trigger.click();
    });

    const firstTask = document.querySelector(
      '[data-testid="board-task-filter-task-1"]',
    ) as HTMLInputElement;
    act(() => {
      firstTask.click();
    });
    expect(onChange).toHaveBeenCalledWith(["task-2"]);
  });
});
