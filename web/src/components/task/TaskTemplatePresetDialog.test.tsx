import { act } from "react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";
import { ensureZhHantLocale } from "../../test/i18nHarness";
import type { TaskTemplatePreset } from "../../types";
import { TaskTemplatePresetDialog } from "./TaskTemplatePresetDialog";
import {
  presetDialogBodyClass,
  presetDialogContainerClass,
  presetDialogFilterChipRowClass,
  presetDialogScrollableClass,
  presetDialogStatusClass,
} from "./taskTemplatePresetDialogClasses";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");

type CatalogEntry = {
  id: string;
  analysisMode: TaskTemplatePreset["analysisMode"];
  defaultAnalysisTimeRange: TaskTemplatePreset["defaultAnalysisTimeRange"];
  badge: string;
  i18n: { "zh-Hant": { name: string; description: string; promptTemplate: string } };
};

function catalogPresets(): TaskTemplatePreset[] {
  const raw = JSON.parse(
    readFileSync(resolve(REPO_ROOT, "shared/task_presets.json"), "utf8"),
  ) as CatalogEntry[];
  return raw.map((entry) => ({
    id: entry.id,
    analysisMode: entry.analysisMode,
    defaultAnalysisTimeRange: entry.defaultAnalysisTimeRange,
    badge: entry.badge,
    name: entry.i18n["zh-Hant"].name,
    description: entry.i18n["zh-Hant"].description,
    promptTemplate: entry.i18n["zh-Hant"].promptTemplate,
  }));
}

function makePreset(
  id: string,
  analysisMode: TaskTemplatePreset["analysisMode"],
): TaskTemplatePreset {
  return {
    id,
    name: `模板 ${id}`,
    description: "說明文字足夠長時也不應撐開對話框寬高",
    analysisMode,
    promptTemplate: "prompt",
    defaultAnalysisTimeRange: "1d",
    badge: "🔥",
  };
}

const PRESETS: TaskTemplatePreset[] = [
  makePreset("lb-1", "leaderboard"),
  makePreset("lb-2", "leaderboard"),
  makePreset("intel-1", "intel_event"),
  makePreset("agent-1", "agent"),
];

describe("TaskTemplatePresetDialog layout stability", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    await ensureZhHantLocale();
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it("freezes shell height and reserves scrollbar gutter / status line", async () => {
    expect(presetDialogContainerClass).toContain("h-[min(88vh,860px)]");
    expect(presetDialogContainerClass).not.toContain("max-h-[min(88vh,860px)]");
    expect(presetDialogBodyClass).toContain("overflow-hidden");
    expect(presetDialogScrollableClass).toContain("[scrollbar-gutter:stable]");
    expect(presetDialogFilterChipRowClass).toContain("flex-nowrap");
    expect(presetDialogStatusClass).toContain("min-h-4");
    expect(presetDialogStatusClass).toContain("whitespace-nowrap");

    await harness.render(TaskTemplatePresetDialog, {
      presets: PRESETS,
      presetsLoading: false,
      presetUsage: {},
      preferredAnalysisMode: "leaderboard",
      selectedPresetId: "lb-1",
      setSelectedPresetId: vi.fn(),
      onApply: vi.fn(),
      onClose: vi.fn(),
    });

    const overlay = document.body.querySelector('[data-testid="task-template-preset-dialog"]');
    expect(overlay).toBeTruthy();
    const shell = overlay?.querySelector('[role="dialog"]') as HTMLElement | null;
    expect(shell?.className ?? "").toContain("h-[min(88vh,860px)]");
    expect(shell?.className ?? "").toContain("w-[min(960px,calc(100vw-32px))]");

    const body = shell?.children[1] as HTMLElement | undefined;
    expect(body?.className ?? "").toContain("im-dialog-body");
    expect(body?.className ?? "").toContain("overflow-hidden");
    expect(body?.className ?? "").not.toContain("overflow-auto");

    const status = overlay?.querySelector('[data-testid="task-template-preset-status"]');
    expect(status?.className ?? "").toContain("min-h-4");
    expect(overlay?.querySelector('[data-testid="task-template-preset-scroll"]')?.className ?? "").toContain(
      "[scrollbar-gutter:stable]",
    );

    const heightBefore = shell?.getBoundingClientRect().height ?? 0;
    const classBefore = shell?.className ?? "";

    const allTab = Array.from(overlay?.querySelectorAll("button") ?? []).find(
      (btn) => (btn.textContent ?? "").trim() === "全部",
    );
    expect(allTab).toBeTruthy();
    await act(async () => {
      allTab?.click();
      await Promise.resolve();
    });

    const heightAfter = shell?.getBoundingClientRect().height ?? 0;
    expect(shell?.className).toBe(classBefore);
    if (heightBefore > 0) {
      expect(heightAfter).toBe(heightBefore);
    }
    expect(status?.textContent ?? "").toContain("目前顯示");
    expect(status?.textContent ?? "").toContain("4");
  });

  it("keeps selected card outline inset without font-weight or scale jitter", async () => {
    const setSelectedPresetId = vi.fn();
    await harness.render(TaskTemplatePresetDialog, {
      presets: PRESETS,
      presetsLoading: false,
      presetUsage: {},
      preferredAnalysisMode: "leaderboard",
      selectedPresetId: "lb-1",
      setSelectedPresetId,
      onApply: vi.fn(),
      onClose: vi.fn(),
    });

    const overlay = document.body.querySelector('[data-testid="task-template-preset-dialog"]');
    const selected = overlay
      ?.querySelector('[data-testid="task-template-preset-scroll"]')
      ?.querySelector('[aria-pressed="true"]');
    expect(selected?.className ?? "").toContain("-outline-offset-2");
    expect(selected?.className ?? "").toContain("outline-accent");
    expect(selected?.className ?? "").not.toContain("font-semibold");
    expect(selected?.className ?? "").not.toContain("scale-[");
    expect(selected?.className ?? "").toContain("hover:!transform-none");
    expect(selected?.className ?? "").toContain("active:!transform-none");
    expect(selected?.className ?? "").not.toContain("ring-inset ring-accent");

    const other = Array.from(document.body.querySelectorAll("button")).find(
      (btn) => (btn.textContent ?? "").includes("模板 lb-2"),
    );
    expect(other).toBeTruthy();
    await act(async () => {
      other?.click();
      await Promise.resolve();
    });
    expect(setSelectedPresetId).toHaveBeenCalledWith("lb-2");
  });
});

describe("TaskTemplatePresetDialog catalog tabs", () => {
  let harness: TestHarness;
  const presets = catalogPresets();

  beforeEach(async () => {
    await ensureZhHantLocale();
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  async function renderPicker(preferredAnalysisMode: TaskTemplatePreset["analysisMode"]) {
    await harness.render(TaskTemplatePresetDialog, {
      presets,
      presetsLoading: false,
      presetUsage: {},
      preferredAnalysisMode,
      selectedPresetId: "",
      setSelectedPresetId: vi.fn(),
      onApply: vi.fn(),
      onClose: vi.fn(),
    });
    return document.body.querySelector('[data-testid="task-template-preset-dialog"]');
  }

  function clickChip(overlay: Element | null, label: string) {
    const chip = Array.from(overlay?.querySelectorAll("button") ?? []).find(
      (btn) => (btn.textContent ?? "").trim() === label,
    );
    expect(chip, `missing chip ${label}`).toBeTruthy();
    return act(async () => {
      chip?.click();
      await Promise.resolve();
    });
  }

  function cardText(overlay: Element | null): string {
    return overlay?.querySelector('[data-testid="task-template-preset-scroll"]')?.textContent ?? "";
  }

  it("lists four 專案經理 templates and two 排行榜 templates from the shared catalog", async () => {
    const overlay = await renderPicker("agent");
    expect(presets).toHaveLength(14);

    let text = cardText(overlay);
    expect(text).toContain("工作輪更");
    expect(text).toContain("專案日程");
    expect(text).toContain("來源核實");
    expect(text).toContain("純網搜");
    expect(text).not.toContain("通用專案日期管理");
    expect(overlay?.querySelector('[data-testid="task-template-preset-status"]')?.textContent ?? "").toMatch(
      /目前顯示 4 \/ 14/,
    );

    await clickChip(overlay, "排行榜任務");
    text = cardText(overlay);
    expect(text).toContain("熱門話題排行");
    expect(text).toContain("討論熱度");
    expect(text).not.toContain("沒有符合目前篩選條件的模板");
    expect(overlay?.querySelector('[data-testid="task-template-preset-status"]')?.textContent ?? "").toMatch(
      /目前顯示 2 \/ 14/,
    );

    await clickChip(overlay, "專案經理任務");
    text = cardText(overlay);
    expect(text).toContain("工作輪更");
    expect(text).toContain("來源核實");
    expect(text).toContain("純網搜");
  });
});
