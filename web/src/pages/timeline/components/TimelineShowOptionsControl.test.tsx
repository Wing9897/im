/**
 * Unit tests for TimelineShowOptionsControl.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimelineShowOptionsControl } from "./TimelineShowOptionsControl";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";

describe("TimelineShowOptionsControl", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await ensureZhHantLocale();
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
        wrapWithI18n(createElement(TimelineShowOptionsControl, {
            showDismissed: props.showDismissed ?? true,
            setShowDismissed,
            showOngoing: props.showOngoing ?? true,
            setShowOngoing,
            showEnding: props.showEnding ?? true,
            setShowEnding,
          })),
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
    expect(trigger.title).toContain("篩選");

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
    ).toContain("篩選");

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
    expect(document.querySelector('[data-testid="timeline-show-options-dates"]')).toBeNull();

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

  it("month date-reveal hover lives on the 篩選 eye; persist is a 顯示日期 checkbox", async () => {
    const onPersistedChange = vi.fn();
    const onPointerEnter = vi.fn();
    const onPointerLeave = vi.fn();
    act(() => {
      root.render(
        wrapWithI18n(
          createElement(TimelineShowOptionsControl, {
            showDismissed: true,
            setShowDismissed: vi.fn(),
            showOngoing: true,
            setShowOngoing: vi.fn(),
            showEnding: true,
            setShowEnding: vi.fn(),
            monthDateReveal: {
              persisted: false,
              onPersistedChange,
              onPointerEnter,
              onPointerLeave,
            },
          }),
        ),
      );
    });

    const trigger = container.querySelector(
      '[data-testid="timeline-show-options"]',
    ) as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute("aria-label")).toBe("篩選");
    expect(trigger.title).toContain("篩選");
    expect(trigger.textContent).not.toContain("顯示");
    expect(trigger.getAttribute("data-dates-persisted")).toBe("false");

    act(() => {
      trigger.dispatchEvent(new MouseEvent("pointerenter", { bubbles: false }));
    });
    expect(onPointerEnter).toHaveBeenCalledTimes(1);

    act(() => {
      trigger.dispatchEvent(new MouseEvent("pointerleave", { bubbles: false }));
    });
    expect(onPointerLeave).toHaveBeenCalledTimes(1);

    act(() => {
      trigger.click();
    });
    expect(onPersistedChange).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="timeline-show-options-menu"]')).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector('[data-testid="timeline-show-options-menu"]')?.textContent).toContain(
      "顯示日期",
    );

    const dates = document.querySelector(
      '[data-testid="timeline-show-options-dates"]',
    ) as HTMLInputElement;
    expect(dates).toBeTruthy();
    expect(dates.checked).toBe(false);
    act(() => {
      dates.click();
    });
    expect(onPersistedChange).toHaveBeenCalledTimes(1);
    expect(onPersistedChange).toHaveBeenCalledWith(true);
  });
});
