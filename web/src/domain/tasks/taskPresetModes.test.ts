import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { AnalysisMode } from "../../types";
import {
  analysisModeSupportsTaskPresets,
  filterTaskTemplatePresetsByMode,
} from "./taskPresetModes";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");

type CatalogPreset = {
  id: string;
  analysisMode: AnalysisMode;
  i18n: { "zh-Hant": { name: string } };
};

const catalog = JSON.parse(
  readFileSync(resolve(REPO_ROOT, "shared/task_presets.json"), "utf8"),
) as CatalogPreset[];

describe("analysisModeSupportsTaskPresets", () => {
  it("allows AI and agent modes", () => {
    expect(analysisModeSupportsTaskPresets("leaderboard")).toBe(true);
    expect(analysisModeSupportsTaskPresets("intel_event")).toBe(true);
    expect(analysisModeSupportsTaskPresets("agent")).toBe(true);
  });
});

describe("filterTaskTemplatePresetsByMode", () => {
  it("lists the four Agent catalog templates under 專案經理任務", () => {
    const ids = filterTaskTemplatePresetsByMode(catalog, "agent").map((preset) => preset.id);
    expect(ids).toEqual([
      "agent-work-shift",
      "agent-project-schedule",
      "agent-source-verify",
      "agent-pure-web-search",
    ]);
    const names = Object.fromEntries(
      catalog
        .filter((preset) => ids.includes(preset.id))
        .map((preset) => [preset.id, preset.i18n["zh-Hant"].name]),
    );
    expect(names).toEqual({
      "agent-work-shift": "工作輪更",
      "agent-project-schedule": "專案日程",
      "agent-source-verify": "來源核實",
      "agent-pure-web-search": "純網搜",
    });
  });

  it("lists leaderboard catalog templates under 排行榜任務", () => {
    const leaderboard = filterTaskTemplatePresetsByMode(catalog, "leaderboard");
    expect(leaderboard.map((preset) => preset.id)).toEqual([
      "leaderboard-hot-topics",
      "leaderboard-discussion-heat",
    ]);
    expect(leaderboard.map((preset) => preset.i18n["zh-Hant"].name)).toEqual([
      "熱門話題排行",
      "討論熱度",
    ]);
  });
});
