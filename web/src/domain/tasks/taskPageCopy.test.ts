import { describe, expect, it, beforeEach, afterEach } from "vitest";
import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import {
  getHideSystemTasksLabel,
  getShowSystemTasksLabel,
  getSystemTasksSectionSubtitle,
  getSystemTasksSectionTitle,
  getTasksEmptyDescription,
  getTasksEmptyTitle,
  getTasksPageLabel,
} from "./taskPageCopy";
import { getSystemTaskCatalog } from "./systemTaskCatalog";

describe("taskPageCopy", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  afterEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("uses 任務設定 as the neutral tasks page label", () => {
    expect(getTasksPageLabel()).toBe("任務設定");
  });

  it("empty state does not imply all tasks are analysis", () => {
    expect(getTasksEmptyTitle()).toBe("尚無任務");
    expect(getTasksEmptyDescription()).toContain("週期任務");
    expect(getTasksEmptyDescription()).not.toContain("分析任務");
  });

  it("exposes system-tasks section copy", () => {
    expect(getShowSystemTasksLabel()).toBe("顯示系統任務");
    expect(getHideSystemTasksLabel()).toBe("隱藏系統任務");
    expect(getSystemTasksSectionTitle()).toContain("僅供檢視");
    expect(getSystemTasksSectionSubtitle()).toContain("不是可編輯的分析任務");
  });
});

describe("systemTaskCatalog", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("includes user-or-assistant virtual card; ownership workset is separate", () => {
    const catalog = getSystemTaskCatalog();
    const userOrAssistant = catalog.find((item) => item.id === "user-or-assistant");
    expect(userOrAssistant?.kind).toBe("virtual");
    expect(userOrAssistant?.title).toBe("用戶或助手");
    expect(userOrAssistant?.staffId).toBe("assistant");
    expect(userOrAssistant?.shortDescription).toContain("一般");
    expect(userOrAssistant?.shortDescription).toContain("工作集");

    const clientManager = catalog.find((item) => item.id === "client-manager");
    expect(clientManager?.kind).toBe("agent");
    expect(clientManager?.title).toBe("客戶經理");
    expect(clientManager?.avatarSrc).toBeTruthy();
    expect(clientManager?.staffId).toBeUndefined();
    expect(clientManager?.shortDescription).toContain("A2A");
    expect(clientManager?.linkTo).toBe("/settings/api");

    const voice = catalog.find((item) => item.id === "voice-reminder");
    expect(voice?.kind).toBe("system");
    expect(voice?.staffId).toBeUndefined();
    expect(voice?.shortDescription).toContain("週期任務");
    expect(voice?.shortDescription).toContain("RRULE");
    expect(voice?.linkTo).toBe("/actions?tab=voice");

    const geocode = catalog.find((item) => item.id === "startup-geocode");
    expect(geocode?.title).toBe("啟動座標回填");
    expect(geocode?.shortDescription).toContain("經緯度");
    expect(geocode?.shortDescription).toContain("地圖");

    const retention = catalog.find((item) => item.id === "retention");
    expect(retention?.title).toBe("資料清理");
    expect(retention?.staffId).toBeUndefined();

    const batch = catalog.find((item) => item.id === "analysis-batch");
    expect(batch?.title).toBe("分析批次");
    expect(batch?.staffId).toBeUndefined();
    expect(batch?.shortDescription).toContain("標記型");
    expect(batch?.shortDescription).toContain("專案任務");
    expect(catalog.find((item) => item.id === "project-manager")).toBeUndefined();
    expect(catalog.find((item) => item.id === "project-tick")).toBeUndefined();
  });

  it("translates key glossary terms under en", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    const catalog = getSystemTaskCatalog();
    expect(catalog.find((item) => item.id === "user-or-assistant")?.title).toBe(
      "User or Assistant",
    );
    expect(catalog.find((item) => item.id === "analysis-batch")?.shortDescription).toContain(
      "intel events",
    );
    expect(catalog.find((item) => item.id === "client-manager")?.title).toBe("Account manager");
  });
});
