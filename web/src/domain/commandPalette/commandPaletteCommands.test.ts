import { beforeEach, afterEach, describe, expect, it } from "vitest";
import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import {
  buildTaskCommandPaletteItems,
  buildWorksetCommandPaletteItems,
  filterCommandPaletteItems,
} from "./commandPaletteCommands";
import type { AnalysisTask } from "../../types";

function makeTask(overrides: Partial<AnalysisTask> = {}): AnalysisTask {
  return {
    id: overrides.id ?? "task-1",
    name: overrides.name ?? "Alpha Monitor",
    description: overrides.description ?? "",
    isActive: overrides.isActive ?? true,
    analysisMode: overrides.analysisMode ?? "intel_event",
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
      makeTask({ id: "t1", name: "BTC Watch", analysisMode: "intel_event" }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "task-t1",
      label: "BTC Watch",
      to: "/tasks/t1/edit",
      group: "任務",
      hint: "intel_event",
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
    const workspace = filterCommandPaletteItems("通知與動作");
    expect(workspace.some((item) => item.to === "/notify" && item.id === "notify")).toBe(true);
    const actionsTab = filterCommandPaletteItems("動作");
    expect(actionsTab.some((item) => item.to === "/notify")).toBe(true);
    const voice = filterCommandPaletteItems("本機通知");
    expect(voice.some((item) => item.to === "/notify?tab=notify")).toBe(true);
    const localNotify = filterCommandPaletteItems("local notify");
    expect(localNotify.some((item) => item.to === "/notify?tab=notify")).toBe(true);
    const legacyVoice = filterCommandPaletteItems("語音提醒");
    expect(legacyVoice.some((item) => item.to === "/notify?tab=notify")).toBe(true);
    const history = filterCommandPaletteItems("觸發");
    expect(history.some((item) => item.to === "/notify?tab=history")).toBe(true);
    const all = filterCommandPaletteItems("");
    expect(all.some((item) => item.to === "/notify")).toBe(true);
    expect(all.some((item) => item.to?.startsWith("/actions"))).toBe(false);
  });

  it("includes the Board canvas switch action", () => {
    const items = filterCommandPaletteItems("ops board");
    expect(items.some((item) => item.id === "board" && item.action === "open-board")).toBe(
      true,
    );
    const canvas = filterCommandPaletteItems("畫布");
    expect(canvas.some((item) => item.id === "board")).toBe(true);
  });

  it("includes subscription mine / published / account / search shortcuts", () => {
    const published = filterCommandPaletteItems("發佈");
    expect(published.some((item) => item.to === "/subscriptions/published")).toBe(true);
    const privateGroup = filterCommandPaletteItems("私人群組");
    expect(privateGroup.some((item) => item.to === "/subscriptions/published")).toBe(true);
    const search = filterCommandPaletteItems("搜尋訂閱");
    expect(search.some((item) => item.to === "/subscriptions/search")).toBe(true);
    const account = filterCommandPaletteItems("日曆分享");
    expect(account.some((item) => item.to === "/subscriptions/account")).toBe(true);
    const mine = filterCommandPaletteItems("訂閱");
    expect(mine.some((item) => item.to === "/subscriptions/mine")).toBe(true);
  });

  it("includes the worksets catalog in navigation", () => {
    const items = filterCommandPaletteItems("工作集");
    expect(items.some((item) => item.to === "/worksets")).toBe(true);
    const tasks = filterCommandPaletteItems("任務");
    expect(tasks.some((item) => item.to === "/worksets?tab=tasks")).toBe(true);
  });

  it("hides simple-mode collect/analyze routes and the workset tasks tab", () => {
    const hidden = filterCommandPaletteItems("", [], i18n.t.bind(i18n), true);
    expect(hidden.some((item) => item.to === "/worksets?tab=tasks")).toBe(false);
    expect(hidden.some((item) => item.to === "/worksets?tab=tasks&scheduling=open")).toBe(false);
    expect(hidden.some((item) => item.to === "/monitor")).toBe(false);
    expect(hidden.some((item) => item.to === "/sources")).toBe(false);
    expect(hidden.some((item) => item.to === "/worksets")).toBe(true);
    expect(hidden.some((item) => item.to === "/timeline")).toBe(true);

    const extras = buildTaskCommandPaletteItems([makeTask()]);
    const withTasks = filterCommandPaletteItems("", extras, i18n.t.bind(i18n), true);
    expect(withTasks.some((item) => item.to?.startsWith("/tasks/"))).toBe(false);
  });

  it("opens a workset contents page", () => {
    const items = buildWorksetCommandPaletteItems([
      {
        id: "ws-1",
        name: "Ops",
        isSystem: false,
        notifyEnabled: true,
        externalEnabled: true,
        createdAt: "",
        updatedAt: "",
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "workset-ws-1",
      label: "Ops",
      to: "/worksets/ws-1",
      group: "工作集",
    });
    expect(items[0]?.to).not.toContain("tab=");
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
    expect(strategy.some((item) => item.to === "/worksets?tab=tasks&scheduling=open")).toBe(true);
    const assistant = filterCommandPaletteItems("助手");
    expect(assistant.some((item) => item.to === "/assistant")).toBe(true);
    const voice = filterCommandPaletteItems("語音");
    expect(voice.some((item) => item.to === "/settings/ai/voice")).toBe(true);
    const api = filterCommandPaletteItems("API");
    expect(api.some((item) => item.to === "/settings/integrations?tab=webhook")).toBe(true);
    const deeplink = filterCommandPaletteItems("deep link");
    expect(deeplink.some((item) => item.to === "/settings/integrations?tab=deeplink")).toBe(true);
    expect(deeplink.some((item) => item.label === "日曆連結")).toBe(true);
    const legacyDeeplink = filterCommandPaletteItems("Desktop 日曆");
    expect(legacyDeeplink.some((item) => item.to === "/settings/integrations?tab=deeplink")).toBe(
      true,
    );
    expect(legacyDeeplink.some((item) => item.label === "日曆連結")).toBe(true);
    const mcp = filterCommandPaletteItems("MCP");
    expect(mcp.some((item) => item.to === "/settings/integrations?tab=mcp")).toBe(true);
    expect(mcp.some((item) => item.to === "/settings/mcp")).toBe(false);
    expect(mcp.some((item) => item.label === "外部接口 · MCP")).toBe(true);
    const systemApis = filterCommandPaletteItems("CARTO");
    expect(systemApis.some((item) => item.to === "/settings/integrations?tab=system")).toBe(true);
    expect(systemApis.some((item) => item.label === "外部接口 · 系統 API 及網址")).toBe(true);
    const integrations = filterCommandPaletteItems("外部接口");
    expect(integrations.some((item) => item.to === "/settings/integrations?tab=webhook")).toBe(true);
    expect(integrations.some((item) => item.to === "/settings/api")).toBe(false);
  });

  it("includes MQTT and Email source shortcuts", () => {
    const mqtt = filterCommandPaletteItems("MQTT");
    expect(mqtt.some((item) => item.to === "/sources?tab=mqtt")).toBe(true);
    const email = filterCommandPaletteItems("Email");
    expect(email.some((item) => item.to === "/sources?tab=email")).toBe(true);
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
    expect(items.some((item) => item.label === "Intel events")).toBe(true);
    expect(items.some((item) => item.group === "Navigation")).toBe(true);
  });
});
