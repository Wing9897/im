import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import i18n from "./i18n";
import { formatMessage, joinList } from "./formatMessage";
import {
  applyDocumentLang,
  getAppLocale,
  getAppLocalePreference,
  getDateTimeLocale,
  resolveAppLocale,
  setAppLocale,
  setAppLocalePreference,
} from "./locale";
import { getTasksPageLabel } from "../domain/tasks/taskPageCopy";
import { filterCommandPaletteItems } from "../domain/commandPalette/commandPaletteCommands";
import { getWidgetMeta } from "../board/widgetRegistry";

describe("formatMessage", () => {
  it("substitutes named placeholders in raw templates", () => {
    expect(formatMessage("已選 {selected} / {total} 個頻道", { selected: 2, total: 5 })).toBe(
      "已選 2 / 5 個頻道",
    );
  });

  it("leaves unknown placeholders intact", () => {
    expect(formatMessage("你好 {name}", {})).toBe("你好 {name}");
  });

  it("resolves message keys via i18n", () => {
    expect(formatMessage("messages.channelsSelected", { selected: 2, total: 5 })).toBe(
      "已選 2 / 5 個頻道",
    );
  });

  it("resolves monitor stream keys via namespaced i18n", () => {
    expect(formatMessage("monitor:stream.done", { total: 12 })).toBe("共 12 則訊息");
  });
});

describe("joinList", () => {
  afterEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("joins with ideographic comma under zh locales", async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
    expect(joinList(["Alice", "Bob", null, ""])).toBe("Alice、Bob");
  });

  it("joins with ASCII comma+space under en", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    expect(joinList(["Alice", "Bob"])).toBe("Alice, Bob");
  });
});

describe("resolveAppLocale", () => {
  it("returns concrete preference unchanged", () => {
    expect(resolveAppLocale("zh-Hant")).toBe("zh-Hant");
    expect(resolveAppLocale("zh-Hans")).toBe("zh-Hans");
    expect(resolveAppLocale("en")).toBe("en");
  });

  it("maps Traditional Chinese browser tags to zh-Hant", () => {
    expect(resolveAppLocale("auto", "zh-TW")).toBe("zh-Hant");
    expect(resolveAppLocale("auto", "zh-HK")).toBe("zh-Hant");
    expect(resolveAppLocale("auto", "zh-MO")).toBe("zh-Hant");
    expect(resolveAppLocale("auto", "zh-Hant")).toBe("zh-Hant");
    expect(resolveAppLocale("auto", "zh-Hant-TW")).toBe("zh-Hant");
    expect(resolveAppLocale("auto", "zh_TW")).toBe("zh-Hant");
  });

  it("maps Simplified Chinese browser tags to zh-Hans", () => {
    expect(resolveAppLocale("auto", "zh-CN")).toBe("zh-Hans");
    expect(resolveAppLocale("auto", "zh-SG")).toBe("zh-Hans");
    expect(resolveAppLocale("auto", "zh-Hans")).toBe("zh-Hans");
    expect(resolveAppLocale("auto", "zh-Hans-CN")).toBe("zh-Hans");
  });

  it("falls unmatched zh* to zh-Hant and non-zh to en", () => {
    expect(resolveAppLocale("auto", "zh")).toBe("zh-Hant");
    expect(resolveAppLocale("auto", "zh-XY")).toBe("zh-Hant");
    expect(resolveAppLocale("auto", "en-US")).toBe("en");
    expect(resolveAppLocale("auto", "ja-JP")).toBe("en");
    expect(resolveAppLocale("auto", "")).toBe("zh-Hant");
  });
});

describe("locale preference persistence", () => {
  beforeEach(() => {
    localStorage.removeItem("im:ui-locale");
  });

  afterEach(() => {
    localStorage.removeItem("im:ui-locale");
    setAppLocale("zh-Hant");
  });

  it("keeps existing concrete localStorage values as manual locks", () => {
    localStorage.setItem("im:ui-locale", "en");
    expect(getAppLocalePreference()).toBe("en");
    expect(getAppLocale()).toBe("en");

    localStorage.setItem("im:ui-locale", "zh-Hans");
    expect(getAppLocalePreference()).toBe("zh-Hans");
    expect(getAppLocale()).toBe("zh-Hans");
  });

  it("stores auto preference and resolves effective locale", () => {
    const languageSpy = vi.spyOn(window.navigator, "language", "get").mockReturnValue("zh-CN");
    setAppLocalePreference("auto");
    expect(localStorage.getItem("im:ui-locale")).toBe("auto");
    expect(getAppLocalePreference()).toBe("auto");
    expect(getAppLocale()).toBe("zh-Hans");
    languageSpy.mockRestore();
  });

  it("setAppLocale still writes a concrete manual preference", () => {
    setAppLocale("en");
    expect(localStorage.getItem("im:ui-locale")).toBe("en");
    expect(getAppLocalePreference()).toBe("en");
    expect(getAppLocale()).toBe("en");
  });

  it("persists resolved concrete locale to server when preference is auto", async () => {
    const languageSpy = vi.spyOn(window.navigator, "language", "get").mockReturnValue("zh-TW");
    const configMod = await import("../api/config");
    const spy = vi.spyOn(configMod, "saveSystemSettings").mockResolvedValue({} as never);

    setAppLocalePreference("auto");
    expect(localStorage.getItem("im:ui-locale")).toBe("auto");
    expect(getAppLocale()).toBe("zh-Hant");

    await vi.waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ uiLocale: "zh-Hant" });
    });
    expect(spy.mock.calls.every((call) => call[0]?.uiLocale !== "auto")).toBe(true);

    spy.mockRestore();
    languageSpy.mockRestore();
  });
});

describe("locale + i18n", () => {
  beforeEach(async () => {
    localStorage.removeItem("im:ui-locale");
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  afterEach(async () => {
    localStorage.removeItem("im:ui-locale");
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
    applyDocumentLang("zh-Hant");
  });

  it("defaults to zh-Hant and maps Intl to zh-TW", () => {
    expect(getAppLocale()).toBe("zh-Hant");
    expect(getDateTimeLocale()).toBe("zh-TW");
  });

  it("persists locale, updates document lang, and syncs i18n.language", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    expect(localStorage.getItem("im:ui-locale")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(i18n.language).toBe("en");
    expect(getTasksPageLabel()).toBe("Tasks");
  });

  it("setAppLocale triggers i18n.changeLanguage via listener", async () => {
    setAppLocale("zh-Hans");
    // listener is sync fire; changeLanguage may be async
    await i18n.changeLanguage("zh-Hans");
    expect(i18n.language).toBe("zh-Hans");
    expect(i18n.t("nav:keyEvents")).toBe("关键事件");
  });

  it("auto preference applies resolved locale to document and i18n", async () => {
    const languageSpy = vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-US");
    setAppLocalePreference("auto");
    await i18n.changeLanguage(getAppLocale());
    expect(document.documentElement.lang).toBe("en");
    expect(i18n.language).toBe("en");
    expect(localStorage.getItem("im:ui-locale")).toBe("auto");
    languageSpy.mockRestore();
  });
});

describe("P0 shell smoke (en)", () => {
  afterEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("command palette and widget meta show English under en", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    const items = filterCommandPaletteItems("");
    expect(items.some((item) => item.label === "Key Events")).toBe(true);
    expect(items.some((item) => item.label === "Live Monitor")).toBe(true);
    expect(getWidgetMeta("events").title).toBe("Intelligence events");
  });
});

describe("I18nextProvider wiring", () => {
  it("renders children", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    act(() => {
      root.render(
        createElement(I18nextProvider, { i18n }, createElement("span", null, "ok")),
      );
    });
    expect(container.textContent).toBe("ok");
    act(() => root.unmount());
    document.body.removeChild(container);
  });
});
