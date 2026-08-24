import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";
import { PipelineGuideChecklist } from "./PipelineGuideChecklist";

function PathnameProbe() {
  const { pathname } = useLocation();
  return createElement("span", { "data-testid": "pathname" }, pathname);
}

function renderChecklist(
  container: HTMLDivElement,
  props: { state: "no_sources" | "no_active_task" | "no_events" | "complete"; assistantSlotReady?: boolean },
) {
  act(() => {
    createRoot(container).render(
      wrapWithI18n(
        createElement(
          MemoryRouter,
          { initialEntries: ["/tasks"] },
          createElement(
            "div",
            null,
            createElement(PipelineGuideChecklist, props),
            createElement(PathnameProbe),
          ),
        ),
      ),
    );
  });
}

describe("PipelineGuideChecklist", () => {
  it("offers RSS plus preset taps when the pipeline has no sources", async () => {
    await ensureZhHantLocale();
    const container = document.createElement("div");
    renderChecklist(container, { state: "no_sources" });
    expect(container.querySelector('[data-testid="pipeline-guide-checklist"]')).not.toBeNull();
    expect(container.textContent).toContain("情報管線");
    const buttons = [...container.querySelectorAll("button")].map((el) => el.textContent?.trim());
    expect(buttons).toContain("新增 RSS");
    expect(buttons).not.toContain("關鍵情報");
    expect(buttons).not.toContain("行程提取");
    expect(container.textContent).toContain("Telegram");
  });

  it("offers key-insights and schedule-events when sources exist but no active task", async () => {
    await ensureZhHantLocale();
    const container = document.createElement("div");
    renderChecklist(container, { state: "no_active_task" });
    const buttons = [...container.querySelectorAll("button")].map((el) => el.textContent?.trim());
    expect(buttons).toContain("關鍵情報");
    expect(buttons).toContain("行程提取");
    expect(buttons).not.toContain("新增 RSS");
  });

  it("offers an optional AI provider step that links to /ai/provider without requiring a slot bind", async () => {
    await ensureZhHantLocale();
    const container = document.createElement("div");
    renderChecklist(container, { state: "no_events", assistantSlotReady: false });
    expect(container.textContent).toContain("建立 AI 設定檔並綁定助手槽");
    expect(container.textContent).toContain("可選");
    const buttons = [...container.querySelectorAll("button")].map((el) => el.textContent?.trim());
    expect(buttons).toContain("AI 供應商");
    expect(buttons).not.toContain("新增 RSS");
    expect(buttons).not.toContain("關鍵情報");

    const aiButton = container.querySelector(
      '[data-testid="pipeline-guide-ai-provider"]',
    ) as HTMLButtonElement | null;
    expect(aiButton).not.toBeNull();
    act(() => {
      aiButton!.click();
    });
    expect(container.querySelector('[data-testid="pathname"]')?.textContent).toBe(
      "/ai/provider",
    );
  });

  it("hides the AI provider CTA once the assistant slot is bound", async () => {
    await ensureZhHantLocale();
    const container = document.createElement("div");
    renderChecklist(container, { state: "no_events", assistantSlotReady: true });
    expect(container.textContent).toContain("建立 AI 設定檔並綁定助手槽");
    expect(container.querySelector('[data-testid="pipeline-guide-ai-provider"]')).toBeNull();
    const buttons = [...container.querySelectorAll("button")].map((el) => el.textContent?.trim());
    expect(buttons).not.toContain("AI 供應商");
  });
});
