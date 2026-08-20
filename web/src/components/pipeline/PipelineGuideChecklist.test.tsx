import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";
import { PipelineGuideChecklist } from "./PipelineGuideChecklist";

describe("PipelineGuideChecklist", () => {
  it("offers RSS plus preset taps when the pipeline has no sources", async () => {
    await ensureZhHantLocale();
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        wrapWithI18n(
          createElement(
            MemoryRouter,
            null,
            createElement(PipelineGuideChecklist, { state: "no_sources" }),
          ),
        ),
      );
    });
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
    act(() => {
      createRoot(container).render(
        wrapWithI18n(
          createElement(
            MemoryRouter,
            null,
            createElement(PipelineGuideChecklist, { state: "no_active_task" }),
          ),
        ),
      );
    });
    const buttons = [...container.querySelectorAll("button")].map((el) => el.textContent?.trim());
    expect(buttons).toContain("關鍵情報");
    expect(buttons).toContain("行程提取");
    expect(buttons).not.toContain("新增 RSS");
  });
});
