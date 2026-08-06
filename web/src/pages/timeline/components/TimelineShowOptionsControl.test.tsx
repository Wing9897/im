/**
 * Unit tests for TimelineShowOptionsControl.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";
import { TimelineShowOptionsControl } from "./TimelineShowOptionsControl";

describe("TimelineShowOptionsControl", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
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
      .querySelectorAll('[data-testid="timeline-show-options-menu"]')
      .forEach((node) => node.remove());
  });

  function renderControl(props: Partial<{
    showDismissed: boolean;
    showOngoing: boolean;
    showEnding: boolean;
  }> = {}) {
    const setShowDismissed = vi.fn();
    const setShowOngoing = vi.fn();
    const setShowEnding = vi.fn();
    act(() => {
      root.render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(TimelineShowOptionsControl, {
            showDismissed: props.showDismissed ?? true,
            setShowDismissed,
            showOngoing: props.showOngoing ?? true,
            setShowOngoing,
            showEnding: props.showEnding ?? true,
            setShowEnding,
          }),
        ),
      );
    });
    return { setShowDismissed, setShowOngoing, setShowEnding };
  }

  it("opens a checkbox menu with three independent options", () => {
    const { setShowDismissed, setShowOngoing, setShowEnding } = renderControl({
      showDismissed: false,
      showOngoing: true,
      showEnding: false,
    });

    const trigger = container.querySelector(
      '[data-testid="timeline-show-options"]',
    ) as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.title).toContain("顯示");

    act(() => {
      trigger.click();
    });

    const menu = document.querySelector(
      '[data-testid="timeline-show-options-menu"]',
    ) as HTMLDivElement;
    expect(menu).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-pressed")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe(menu.id);
    expect(menu.getAttribute("role")).toBe("dialog");
    expect(menu.getAttribute("aria-modal")).toBe("true");
    expect(menu.getAttribute("aria-labelledby")).toBeTruthy();
    expect(
      document.getElementById(menu.getAttribute("aria-labelledby")!)?.textContent,
    ).toContain("顯示");

    const dismissed = document.querySelector(
      '[data-testid="timeline-show-options-dismissed"]',
    ) as HTMLInputElement;
    const ongoing = document.querySelector(
      '[data-testid="timeline-show-options-ongoing"]',
    ) as HTMLInputElement;
    const ending = document.querySelector(
      '[data-testid="timeline-show-options-ending"]',
    ) as HTMLInputElement;

    expect(dismissed).toBeTruthy();
    expect(ongoing).toBeTruthy();
    expect(ending).toBeTruthy();
    expect(dismissed.checked).toBe(false);
    expect(ongoing.checked).toBe(true);
    expect(ending.checked).toBe(false);
    expect(document.activeElement).toBe(dismissed);
    expect(menu?.textContent).toContain("顯示已移除");
    expect(menu?.textContent).toContain("顯示進行中");
    expect(menu?.textContent).toContain("顯示結束");
    expect(
      document.getElementById(dismissed.getAttribute("aria-describedby")!)?.textContent,
    ).toContain("軟移除");
    expect(
      document.querySelector('[data-testid^="timeline-filter-show-"]'),
    ).toBeNull();

    act(() => {
      dismissed.click();
    });
    expect(setShowDismissed).toHaveBeenCalledWith(true);

    act(() => {
      ongoing.click();
    });
    expect(setShowOngoing).toHaveBeenCalledWith(false);

    act(() => {
      ending.click();
    });
    expect(setShowEnding).toHaveBeenCalledWith(true);
  });

  it("reports filtering independently from whether the dialog is open", () => {
    renderControl({
      showDismissed: true,
      showOngoing: false,
      showEnding: true,
    });

    const trigger = container.querySelector(
      '[data-testid="timeline-show-options"]',
    ) as HTMLButtonElement;
    expect(trigger.getAttribute("aria-pressed")).toBe("true");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    act(() => {
      trigger.click();
    });
    expect(trigger.getAttribute("aria-pressed")).toBe("true");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("does not report filtering when all options are on, even while open", () => {
    renderControl({
      showDismissed: true,
      showOngoing: true,
      showEnding: true,
    });

    const trigger = container.querySelector(
      '[data-testid="timeline-show-options"]',
    ) as HTMLButtonElement;
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-pressed")).toBe("false");

    act(() => {
      trigger.click();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-pressed")).toBe("false");
  });

  it("closes on Escape and returns focus to the trigger", () => {
    renderControl();
    const trigger = container.querySelector(
      '[data-testid="timeline-show-options"]',
    ) as HTMLButtonElement;

    act(() => {
      trigger.click();
    });
    expect(document.activeElement).not.toBe(trigger);

    act(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(
      document.querySelector('[data-testid="timeline-show-options-menu"]'),
    ).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });
});
