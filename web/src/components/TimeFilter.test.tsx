import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAppLocale } from "../i18n";
import { ensureZhHantLocale, i18n, wrapWithI18n } from "../test/i18nHarness";

import { TimeFilter, TIME_FILTER_PRESETS } from "./TimeFilter";

function openTimeFilter(container: HTMLElement) {
  const trigger = container.querySelector<HTMLButtonElement>(
    '[data-testid="time-filter-value"]',
  );
  expect(trigger).not.toBeNull();
  act(() => {
    trigger!.click();
  });
  return trigger!;
}

describe("TimeFilter", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    await ensureZhHantLocale();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders a compact MenuSelect with all presets", () => {
    act(() => {
      root = createRoot(container);
      root.render(wrapWithI18n(<TimeFilter value="today" onChange={vi.fn()} />));
    });

    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-testid="time-filter-value"]',
    );
    expect(trigger).not.toBeNull();
    expect(trigger!.getAttribute("aria-label")).toBe("時間篩選");
    expect(trigger!.textContent).toContain("本日");

    openTimeFilter(container);
    const labels = TIME_FILTER_PRESETS.map((p) => i18n.t(p.labelKey));
    for (const label of labels) {
      expect(document.body.textContent).toContain(label);
    }
    expect(labels).toEqual(["本日", "1天", "7天", "30天"]);
  });

  it("smoke: English preset labels", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");

    act(() => {
      root = createRoot(container);
      root.render(wrapWithI18n(<TimeFilter value="today" onChange={vi.fn()} />));
    });

    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-testid="time-filter-value"]',
    );
    expect(trigger).not.toBeNull();
    expect(trigger!.getAttribute("aria-label")).toBe("Time filter");
    openTimeFilter(container);
    expect(document.body.textContent).toContain("Today");
    expect(document.body.textContent).toContain("1 day");
    expect(document.body.textContent).toContain("7 days");
    expect(document.body.textContent).toContain("30 days");
  });

  it("reflects the current value on the trigger", () => {
    act(() => {
      root = createRoot(container);
      root.render(wrapWithI18n(<TimeFilter value="7d" onChange={vi.fn()} />));
    });

    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-testid="time-filter-value"]',
    )!;
    expect(trigger.textContent).toContain("7天");
  });

  it("calls onChange when a preset is selected", () => {
    const onChange = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(wrapWithI18n(<TimeFilter value="today" onChange={onChange} />));
    });

    openTimeFilter(container);
    act(() => {
      document.body
        .querySelector<HTMLButtonElement>('[data-testid="time-filter-option-30d"]')
        ?.click();
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("30d");
  });

  it("does not render preset chip buttons outside MenuSelect", () => {
    act(() => {
      root = createRoot(container);
      root.render(wrapWithI18n(<TimeFilter value="today" onChange={vi.fn()} />));
    });

    // One trigger button only (no chip row).
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(container.querySelector('[data-testid="time-filter-value"]')).not.toBeNull();
  });
});
