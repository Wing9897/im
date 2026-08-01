import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";
import { ChatAnalysisFields, TIME_RANGE_VALUES } from "./ChatAnalysisFields";

const LABEL_KEYS = {
  all: "tasks.editor.timeAll",
  "30d": "tasks.editor.time30d",
  "7d": "tasks.editor.time7d",
  "1d": "tasks.editor.time1d",
} as const;

function renderFields(
  container: HTMLElement,
  overrides: Partial<Parameters<typeof ChatAnalysisFields>[0]> = {},
) {
  const defaults = {
    analysisTimeRange: "all",
    onAnalysisTimeRangeChange: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  act(() => {
    createRoot(container).render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ChatAnalysisFields, props),
      ),
    );
  });
  return props;
}

describe("ChatAnalysisFields — Analysis Time Range chips", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("renders chip buttons for the time range field, not a <select>", () => {
    const container = document.createElement("div");
    renderFields(container);
    expect(container.querySelector("select")).toBeNull();
    const chips = container.querySelectorAll("button");
    expect(chips.length).toBe(TIME_RANGE_VALUES.length);
  });

  it("renders exactly 4 chips with correct labels", () => {
    const container = document.createElement("div");
    renderFields(container);
    const chips = Array.from(container.querySelectorAll("button"));
    expect(chips.map((chip) => chip.textContent)).toEqual(
      TIME_RANGE_VALUES.map((value) => String(i18n.t(LABEL_KEYS[value]))),
    );
  });

  it("TIME_RANGE_VALUES includes expected preset values", () => {
    expect(TIME_RANGE_VALUES).toEqual(["all", "30d", "7d", "1d"]);
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
      const expectedLabel = String(i18n.t(LABEL_KEYS[value]));
      for (const chip of chips) {
        const pressed = chip.getAttribute("aria-pressed") === "true";
        expect(pressed).toBe(chip.textContent === expectedLabel);
      }
    }
  });
});
