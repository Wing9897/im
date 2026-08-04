import { describe, expect, it } from "vitest";
import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import { resolveLogDisplayMessage } from "./resolveLogDisplayMessage";

describe("resolveLogDisplayMessage", () => {
  it("falls back to baked message when details lack messageKey", () => {
    expect(
      resolveLogDisplayMessage({
        message: "legacy baked line",
        details: JSON.stringify({ taskId: "t1" }),
      }),
    ).toBe("legacy baked line");
  });

  it("re-resolves batch failure templates for the active locale", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    const details = JSON.stringify({
      messageKey: "logs:templates.batchExhausted",
      messageParams: {
        taskName: "Task A",
        shortBatch: "batch-ab…",
        summary: "LLM timeout",
        maxRetries: 3,
        currentRetry: 3,
      },
    });
    const message = resolveLogDisplayMessage({
      message: "分析批次重試用盡（3 次），待恢復分析後再試：Task A（batch-ab…）— LLM timeout",
      details,
    });
    expect(message).toContain("retries exhausted");
    expect(message).toContain("Task A");
    expect(message).toContain("LLM timeout");

    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
    const zh = resolveLogDisplayMessage({
      message: "Analysis batch retries exhausted…",
      details,
    });
    expect(zh).toContain("重試用盡");
  });

  it("resolves analysisTrace template from the v1 envelope", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    const message = resolveLogDisplayMessage({
      message: "Analysis trace fallback",
      details: JSON.stringify({
        v: 1,
        messageKey: "logs:templates.analysisTrace",
        messageParams: { summary: "prompt assembled" },
      }),
    });
    expect(message).toContain("Analysis trace");
    expect(message).toContain("prompt assembled");
  });
});
