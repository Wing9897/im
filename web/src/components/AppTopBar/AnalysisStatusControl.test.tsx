import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AnalysisStatusControl } from "./AnalysisStatusControl";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";

describe("AnalysisStatusControl", () => {
  beforeEach(async () => {
    await ensureZhHantLocale();
  });
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
    document.querySelectorAll("[data-testid='system-status-menu']").forEach((node) => {
      node.remove();
    });
  });

  function render(overrides: Partial<ComponentProps<typeof AnalysisStatusControl>> = {}) {
    const props = {
      color: "var(--warning)",
      label: "分析已暫停",
      title: "收集器運行中 · AI 分析已暫停",
      analysisPaused: true,
      busy: false,
      abortingAnalysis: false,
      onTogglePause: vi.fn(),
      onEmergencyAbort: vi.fn(async () => {}),
      ...overrides,
    };
    act(() => {
      root = createRoot(container);
      root.render(wrapWithI18n(createElement(AnalysisStatusControl, props)));
    });
    return props;
  }

  it("clicking the status pill toggles pause/resume", () => {
    const props = render();
    const pill = container.querySelector("[data-testid='system-status-pill']") as HTMLButtonElement;
    expect(pill).not.toBeNull();

    act(() => {
      pill.click();
    });
    expect(props.onTogglePause).toHaveBeenCalledTimes(1);
  });

  it("reveals emergency abort via the hover chevron menu", () => {
    render();
    const trigger = container.querySelector(
      "[data-testid='system-status-menu-trigger']",
    ) as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    const slot = trigger.closest(".grid");
    expect(slot?.className).toContain("grid-cols-[0fr]");
    expect(slot?.className).toContain("group-hover:grid-cols-[1fr]");

    act(() => {
      trigger.click();
    });
    const menu = document.querySelector("[data-testid='system-status-menu']");
    expect(menu).not.toBeNull();
    expect(document.querySelector("[data-testid='emergency-abort-button']")).not.toBeNull();
    expect(menu?.parentElement).toBe(document.body);
  });

  it("offers AI settings deep-link when AI is unavailable", () => {
    const onOpenAiSettings = vi.fn();
    render({
      label: "AI 無法連線",
      title: "收集器運行中，但 AI 引擎無法連線",
      aiUnavailable: true,
      onOpenAiSettings,
    });
    const trigger = container.querySelector(
      "[data-testid='system-status-menu-trigger']",
    ) as HTMLButtonElement;

    act(() => {
      trigger.click();
    });
    const settingsBtn = document.querySelector(
      "[data-testid='open-ai-settings-button']",
    ) as HTMLButtonElement;
    expect(settingsBtn).not.toBeNull();
    expect(settingsBtn.textContent).toContain("AI 設定");

    act(() => {
      settingsBtn.click();
    });
    expect(onOpenAiSettings).toHaveBeenCalledTimes(1);
  });

  it("does not show a permanent pause or abort toolbar button", () => {
    render();
    expect(container.querySelector("[data-testid='pause-resume-button']")).toBeNull();
    expect(container.querySelector("[data-testid='emergency-abort-button']")).toBeNull();
  });

  it("composes tooltip that matches analysis resume + emergency abort", () => {
    render({
      label: "分析已暫停",
      title: "AI 分析已暫停 · 收集器已停止",
      analysisPaused: true,
    });
    const pill = container.querySelector("[data-testid='system-status-pill']") as HTMLButtonElement;
    const root = pill.closest("[data-testid='analysis-status-control']");
    const titled = root?.querySelector("[title]") as HTMLElement | null;
    expect(titled?.getAttribute("title")).toBe(
      "AI 分析已暫停 · 收集器已停止（點擊繼續分析；懸停展開可緊急中止）",
    );
    expect(pill.getAttribute("aria-label")).toBe("分析已暫停。點擊繼續分析");
  });

  it("omits click/abort hints when controls are disabled", () => {
    render({
      label: "啟動失敗",
      title: "收集器啟動失敗",
      analysisPaused: true,
      disabled: true,
    });
    const pill = container.querySelector("[data-testid='system-status-pill']") as HTMLButtonElement;
    const root = pill.closest("[data-testid='analysis-status-control']");
    const titled = root?.querySelector("[title]") as HTMLElement | null;
    expect(titled?.getAttribute("title")).toBe("收集器啟動失敗");
    expect(pill.getAttribute("aria-label")).toBe("啟動失敗");
    expect(pill.disabled).toBe(true);
  });
});
