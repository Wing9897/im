import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { TASK_ANALYSIS_TIME_RANGE_I18N_KEYS } from "../../../domain/tasks/taskAnalysisTimeRange";
import { ChatAnalysisFields, TIME_RANGE_VALUES } from "./ChatAnalysisFields";
import { ensureZhHantLocale, i18n, wrapWithI18n } from "../../../test/i18nHarness";

function renderFields(
  container: HTMLElement,
  overrides: Partial<Parameters<typeof ChatAnalysisFields>[0]> = {},
) {
  const defaults = {
    analysisTimeRange: "all" as const,
    onAnalysisTimeRangeChange: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  act(() => {
    createRoot(container).render(
      wrapWithI18n(createElement(ChatAnalysisFields, props)),
    );
  });
  return props;
}

describe("ChatAnalysisFields — Analysis Time Range chips", () => {
  beforeEach(async () => {
    await ensureZhHantLocale();
  });

  it("renders chip buttons for the time range field, not a <select>", () => {
    const container = document.createElement("div");
    renderFields(container);
    expect(container.querySelector("select")).toBeNull();
    const chips = container.querySelectorAll("button");
    expect(chips.length).toBe(TIME_RANGE_VALUES.length);
    expect(container.firstElementChild?.className).toContain("items-center");
  });

  it("renders a chip for every task-legal time range with correct labels", () => {
    const container = document.createElement("div");
    renderFields(container);
    const chips = Array.from(container.querySelectorAll("button"));
    expect(chips.map((chip) => chip.textContent)).toEqual(
      TIME_RANGE_VALUES.map((value) => String(i18n.t(TASK_ANALYSIS_TIME_RANGE_I18N_KEYS[value]))),
    );
  });

  it("TIME_RANGE_VALUES covers the full task DB allowlist", () => {
    expect(TIME_RANGE_VALUES).toEqual([
      "all",
      "30d",
      "7d",
      "48h",
      "1d",
      "today",
      "6h",
      "1h",
    ]);
  });

  it("invokes onAnalysisTimeRangeChange with the correct value when a chip is clicked", () => {
    const container = document.createElement("div");
    const props = renderFields(container);
    const chips = Array.from(container.querySelectorAll("button"));

    for (const [idx, value] of TIME_RANGE_VALUES.entries()) {
      act(() => {
        chips[idx].click();
      });
      expect(props.onAnalysisTimeRangeChange).toHaveBeenCalledWith(value);
    }
    expect(props.onAnalysisTimeRangeChange).toHaveBeenCalledTimes(TIME_RANGE_VALUES.length);
  });

  it("marks the active chip via aria-pressed from analysisTimeRange", () => {
    for (const value of TIME_RANGE_VALUES) {
      const container = document.createElement("div");
      renderFields(container, { analysisTimeRange: value });
      const chips = Array.from(container.querySelectorAll("button"));
      const expectedLabel = String(i18n.t(TASK_ANALYSIS_TIME_RANGE_I18N_KEYS[value]));
      for (const chip of chips) {
        const pressed = chip.getAttribute("aria-pressed") === "true";
        expect(pressed).toBe(chip.textContent === expectedLabel);
      }
    }
  });
});
