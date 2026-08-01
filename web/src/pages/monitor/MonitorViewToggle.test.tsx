import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import { MonitorViewToggle } from "./MonitorViewToggle";
import type { MonitorViewMode } from "../../domain/monitor/monitorViewMode";

function renderToggle(mode: MonitorViewMode, onChange: (mode: MonitorViewMode) => void) {
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(MonitorViewToggle, { mode, onChange }),
      ),
    );
  });
  return container;
}

describe("MonitorViewToggle", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("renders card, list, and wall buttons", () => {
    const container = renderToggle("card", () => {});
    const labels = Array.from(container.querySelectorAll("button")).map((btn) => btn.textContent);
    expect(labels).toEqual(["卡片", "清單", "訊息牆"]);
  });

  it("calls onChange with wall when wall button is clicked", () => {
    const onChange = vi.fn();
    const container = renderToggle("card", onChange);
    const wallButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "訊息牆",
    );
    act(() => {
      wallButton!.click();
    });
    expect(onChange).toHaveBeenCalledWith("wall");
  });

  it("smoke: English view labels", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    const container = renderToggle("card", () => {});
    const labels = Array.from(container.querySelectorAll("button")).map((btn) => btn.textContent);
    expect(labels).toEqual(["Cards", "List", "Message wall"]);
  });
});
