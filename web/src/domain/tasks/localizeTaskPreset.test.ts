import { beforeEach, describe, expect, it } from "vitest";
import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import type { TaskTemplatePreset } from "../../types";
import { localizeTaskPreset, normalizePresetTimeRange } from "./localizeTaskPreset";

const sample: TaskTemplatePreset = {
  id: "schedule-events",
  name: "行程事件提取",
  description: "fallback zh",
  promptTemplate: "fallback prompt",
  analysisMode: "event",
  defaultAnalysisTimeRange: "1d",
  badge: "📅",
};

describe("localizeTaskPreset", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("keeps known editor windows and defaults unknown to 1d", () => {
    expect(normalizePresetTimeRange("1d")).toBe("1d");
    expect(normalizePresetTimeRange("7d")).toBe("7d");
    expect(normalizePresetTimeRange("12h")).toBe("1d");
    expect(normalizePresetTimeRange("bogus")).toBe("1d");
  });

  it("localizes builtin presets under en", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    const localized = localizeTaskPreset(sample, i18n.t.bind(i18n));
    expect(localized.name).toBe("Schedule event extraction");
    expect(localized.description).toContain("Conservative");
    expect(localized.defaultAnalysisTimeRange).toBe("1d");
    expect(localized.promptTemplate.length).toBeGreaterThan(40);
  });
});
