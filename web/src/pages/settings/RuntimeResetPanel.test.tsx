import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import i18n from "../../i18n";
import { RuntimeResetPanel } from "./RuntimeResetPanel";

beforeEach(async () => {
  await i18n.changeLanguage("zh-Hant");
});

describe("RuntimeResetPanel", () => {
  function renderPanel(
    container: HTMLElement,
    overrides: Partial<Parameters<typeof RuntimeResetPanel>[0]> = {},
  ) {
    const defaults = {
      resettingRuntimeData: false,
      onRequestConfirm: vi.fn(),
    };
    const props = { ...defaults, ...overrides };
    act(() => {
      createRoot(container).render(createElement(RuntimeResetPanel, props));
    });
    return props;
  }

  it("renders danger zone title and description", () => {
    const container = document.createElement("div");
    renderPanel(container);
    expect(container.textContent).toContain(i18n.t("settings:data.runtimeResetDescription"));
    expect(container.textContent).toContain(i18n.t("settings:data.fullResetButton"));
  });

  it("calls onRequestConfirm when reset button is clicked", () => {
    const container = document.createElement("div");
    const props = renderPanel(container);
    const btn = container.querySelector("button")!;
    act(() => {
      btn.click();
    });
    expect(props.onRequestConfirm).toHaveBeenCalled();
  });

  it("disables button and shows loading text when resettingRuntimeData is true", () => {
    const container = document.createElement("div");
    renderPanel(container, { resettingRuntimeData: true });
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain("重啟中");
  });
});
