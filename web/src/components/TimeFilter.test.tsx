import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAppLocale } from "../i18n";
import { ensureZhHantLocale, i18n, wrapWithI18n } from "../test/i18nHarness";

import { TimeFilter, TIME_FILTER_PRESETS } from "./TimeFilter";

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

  it("renders a compact select with all presets", () => {
    act(() => {
      root = createRoot(container);
      root.render(wrapWithI18n(<TimeFilter value="today" onChange={vi.fn()} />));
    });

    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="時間篩選"]',
    );
    expect(select).not.toBeNull();
    const labels = Array.from(select!.options).map((o) => o.textContent);
    expect(labels).toEqual(
      TIME_FILTER_PRESETS.map((p) => i18n.t(p.labelKey)),
    );
    expect(labels).toEqual(["本日", "1天", "7天", "30天"]);
  });

  it("smoke: English preset labels", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");

    act(() => {
      root = createRoot(container);
      root.render(wrapWithI18n(<TimeFilter value="today" onChange={vi.fn()} />));
    });

    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Time filter"]',
    );
    expect(select).not.toBeNull();
    const labels = Array.from(select!.options).map((o) => o.textContent);
    expect(labels).toEqual(["Today", "1 day", "7 days", "30 days"]);
  });

  it("reflects the current value on the select", () => {
    act(() => {
      root = createRoot(container);
      root.render(wrapWithI18n(<TimeFilter value="7d" onChange={vi.fn()} />));
    });

    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="時間篩選"]',
    )!;
    expect(select.value).toBe("7d");
  });

  it("calls onChange when a preset is selected", () => {
    const onChange = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(wrapWithI18n(<TimeFilter value="today" onChange={onChange} />));
    });

    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="時間篩選"]',
    )!;
    act(() => {
      select.value = "30d";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("30d");
  });

  it("does not render preset chip buttons", () => {
    act(() => {
      root = createRoot(container);
      root.render(wrapWithI18n(<TimeFilter value="today" onChange={vi.fn()} />));
    });

    expect(container.querySelectorAll("button").length).toBe(0);
  });
});
