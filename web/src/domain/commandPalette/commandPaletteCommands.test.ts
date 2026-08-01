import { beforeEach, afterEach, describe, expect, it } from "vitest";
import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import {
  buildTaskCommandPaletteItems,
  filterCommandPaletteItems,
} from "./commandPaletteCommands";
import type { AnalysisTask } from "../../types";

function makeTask(overrides: Partial<AnalysisTask> = {}): AnalysisTask {
  return {
    id: overrides.id ?? "task-1",
    name: overrides.name ?? "Alpha Monitor",
    description: overrides.description ?? "",
    isActive: overrides.isActive ?? true,
    analysisMode: overrides.analysisMode ?? "event",
    channelIds: overrides.channelIds ?? [],
    createdAt: overrides.createdAt ?? "",
    updatedAt: overrides.updatedAt ?? "",
  } as AnalysisTask;
}

describe("commandPaletteCommands", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });
  afterEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("builds task items with edit deep links", () => {
    const items = buildTaskCommandPaletteItems([
      makeTask({ id: "t1", name: "BTC Watch", analysisMode: "event" }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "task-t1",
      label: "BTC Watch",
      to: "/tasks/t1/edit",
      group: "任務",
      hint: "event",
    });
  });

  it("filters static and task items together", () => {
    const tasks = buildTaskCommandPaletteItems([
      makeTask({ id: "t1", name: "Stablecoin Radar" }),
    ]);
    const filtered = filterCommandPaletteItems("stablecoin", tasks);
    expect(filtered.some((item) => item.id === "task-t1")).toBe(true);
    expect(filtered.every((item) => item.label.toLowerCase().includes("stablecoin") || (item.keywords ?? []).some((k) => k.toLowerCase().includes("stablecoin")))).toBe(true);
  });

  it("includes actions voice and history tab shortcuts", () => {
    const voice = filterCommandPaletteItems("語音提醒");
    expect(voice.some((item) => item.to === "/actions?tab=voice")).toBe(true);
    const history = filterCommandPaletteItems("觸發");
    expect(history.some((item) => item.to === "/actions?tab=history")).toBe(true);
  });

  it("opens the message wall through the monitor route", () => {
    const wall = filterCommandPaletteItems("看板").find(
      (item) => item.id === "monitor-wall",
    );

    expect(wall?.to).toBe("/monitor?view=wall");
    expect(wall?.to).not.toBe("/wall");
  });

  it("includes data maintenance and AI strategy shortcuts", () => {
    const items = filterCommandPaletteItems("資料");
    expect(items.some((item) => item.to === "/settings/data")).toBe(true);
    const strategy = filterCommandPaletteItems("調度");
    expect(strategy.some((item) => item.to === "/ai/analysis-strategy")).toBe(true);
    const assistant = filterCommandPaletteItems("助手");
    expect(assistant.some((item) => item.to === "/assistant")).toBe(true);
    const voice = filterCommandPaletteItems("語音");
    expect(voice.some((item) => item.to === "/ai/voice")).toBe(true);
    const api = filterCommandPaletteItems("API");
    expect(api.some((item) => item.to === "/settings/api")).toBe(true);
  });

  it("includes MQTT and Email source shortcuts", () => {
    const mqtt = filterCommandPaletteItems("MQTT");
    expect(mqtt.some((item) => item.to === "/accounts?tab=mqtt")).toBe(true);
    const email = filterCommandPaletteItems("Email");
    expect(email.some((item) => item.to === "/accounts?tab=email")).toBe(true);
  });

  it("includes the shortcut help action", () => {
    const items = filterCommandPaletteItems("快捷鍵");
    expect(items).toContainEqual(
      expect.objectContaining({
        id: "shortcut-help",
        action: "show-shortcuts",
        label: "快捷鍵說明",
      }),
    );
  });

  it("includes the quick assistant action without replacing full-page nav", () => {
    const quick = filterCommandPaletteItems("助手");
    expect(quick).toContainEqual(
      expect.objectContaining({
        id: "open-assistant-quick",
        action: "open-assistant-quick",
        label: "助手",
        group: "動作",
      }),
    );
    const popup = filterCommandPaletteItems("popup");
    expect(popup.some((item) => item.action === "open-assistant-quick")).toBe(true);
    const nav = filterCommandPaletteItems("助手");
    expect(nav.some((item) => item.to === "/assistant")).toBe(true);
  });

  it("shows English labels under en", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    const items = filterCommandPaletteItems("");
    expect(items.some((item) => item.label === "Key Events")).toBe(true);
    expect(items.some((item) => item.group === "Navigation")).toBe(true);
  });
});
