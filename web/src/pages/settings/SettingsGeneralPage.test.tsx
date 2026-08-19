import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { SimpleModeProvider } from "../../context/SimpleModeContext";
import { systemLocation } from "../../hooks/monthWeather/timezone";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";

const saveSystemSettings = vi.fn();
const restartCollector = vi.fn();
const applyPersistedSnapshot = vi.fn();
const { settingsState } = vi.hoisted(() => ({
  settingsState: {
    weatherLocation: "system",
    analysisTraceVerbose: false,
  },
}));

vi.mock("../../api/config", () => ({ saveSystemSettings }));
vi.mock("../../api/system", () => ({ restartCollector }));
vi.mock("../../components/settings/SystemVersionPanel", () => ({
  SystemVersionPanel: () => createElement("div", { "data-testid": "system-version-panel" }, "version"),
}));
vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());
vi.mock("../../hooks/useFocusTrap", () => ({ useFocusTrap: () => ({ current: null }) }));
vi.mock("./SettingsShared", () => ({
  SettingsContentCard: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
  SettingsFieldGroup: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
}));
vi.mock("../../components/settings/useSettingsPageState", () => ({
  useSettingsPageState: () => ({
    settings: settingsState,
    applyPersistedSnapshot,
  }),
}));

const { SettingsGeneralPage } = await import("./SettingsGeneralPage");

function SettingsGeneralPageWithProviders() {
  return createElement(SimpleModeProvider, null, createElement(SettingsGeneralPage));
}

describe("SettingsGeneralPage", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    await i18n.changeLanguage("zh-Hant");
    settingsState.weatherLocation = "system";
    settingsState.analysisTraceVerbose = false;
    harness = createTestHarness();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    harness.cleanup();
    window.localStorage.clear();
  });

  it("defaults the weather region to follow the system", async () => {
    await harness.render(SettingsGeneralPageWithProviders);

    const follow = harness.container.querySelector('[data-testid="weather-follow-system"]');
    expect(follow?.getAttribute("aria-checked")).toBe("true");
    expect(harness.container.textContent).toContain("跟系統");
  });

  it("lists the resolved OS region while follow-system is on", async () => {
    await harness.render(SettingsGeneralPageWithProviders);

    const readout = harness.container.querySelector('[data-testid="weather-location-current"]');
    expect(readout?.textContent).toBe(`目前地區：${systemLocation()}`);
    expect(readout?.textContent).not.toMatch(/system/i);
    expect(harness.container.querySelector('[data-testid="general-region-card"]')?.contains(readout)).toBe(
      true,
    );
  });

  it("lists the stored custom region when follow-system is off", async () => {
    settingsState.weatherLocation = "Hong Kong";
    await harness.render(SettingsGeneralPageWithProviders);

    const follow = harness.container.querySelector('[data-testid="weather-follow-system"]');
    expect(follow?.getAttribute("aria-checked")).toBe("false");
    const readout = harness.container.querySelector('[data-testid="weather-location-current"]');
    expect(readout?.textContent).toBe("目前地區：Hong Kong");
  });

  it("exposes a simple-mode toggle for basic calendar UX", async () => {
    await harness.render(SettingsGeneralPageWithProviders);
    const toggle = harness.container.querySelector('[data-testid="simple-mode-toggle"]');
    expect(toggle).toBeTruthy();
    expect(toggle?.getAttribute("role")).toBe("switch");
    expect(toggle?.getAttribute("aria-checked")).toBe("false");
    expect(toggle?.className).not.toContain("im-surface-inset");
    expect(toggle?.className).not.toContain("border-accent");
    expect(harness.container.textContent).toContain("簡化模式");
    const row = toggle?.parentElement;
    expect(row?.className).toContain("items-center");
    expect(row?.textContent).toContain("簡化模式（基本日曆）");
    expect(row?.textContent).not.toContain("AI 日曆");
  });

  it("shows the interface language switcher near general prefs", async () => {
    await harness.render(SettingsGeneralPageWithProviders);

    expect(harness.container.querySelector('[data-testid="language-switcher"]')).not.toBeNull();
    expect(harness.container.textContent).toContain("介面語言");
    expect(harness.container.textContent).toContain("繁體中文");
  });

  it("frames language and simple mode as two panel cards on one row", async () => {
    await harness.render(SettingsGeneralPageWithProviders);

    const languageCard = harness.container.querySelector('[data-testid="general-language-card"]');
    const simpleCard = harness.container.querySelector('[data-testid="general-simple-mode-card"]');
    const regionCard = harness.container.querySelector('[data-testid="general-region-card"]');
    expect(languageCard?.className).toContain("im-material-panel");
    expect(simpleCard?.className).toContain("im-material-panel");
    expect(regionCard?.className).toContain("im-material-panel");

    const grid = languageCard?.parentElement;
    expect(grid?.className).toContain("md:grid-cols-2");
    expect(grid).toBe(simpleCard?.parentElement);
    expect(grid?.contains(regionCard)).toBe(false);

    expect(languageCard?.querySelector('[data-testid="language-switcher"]')).not.toBeNull();
    expect(simpleCard?.querySelector('[data-testid="simple-mode-toggle"]')).not.toBeNull();
    expect(regionCard?.querySelector('[data-testid="weather-follow-system"]')).not.toBeNull();
    const weatherToggle = regionCard?.querySelector('[data-testid="weather-follow-system"]');
    expect(weatherToggle?.parentElement?.className).toContain("items-center");

    const save = Array.from(harness.container.querySelectorAll("button")).find(
      (button) => button.textContent === "儲存地區",
    );
    expect(save).toBeTruthy();
    expect(save?.className).not.toContain("w-full");
    expect(regionCard?.contains(save!)).toBe(true);
  });

  it("persists a custom weather region", async () => {
    saveSystemSettings.mockResolvedValue({ weatherLocation: "臺北" });
    await harness.render(SettingsGeneralPageWithProviders);
    const follow = harness.container.querySelector<HTMLButtonElement>(
      '[data-testid="weather-follow-system"]',
    )!;
    await act(async () => {
      follow.click();
    });
    const input = harness.container.querySelector<HTMLInputElement>('#weather-location')!;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      nativeInputValueSetter.call(input, "臺北");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const save = Array.from(harness.container.querySelectorAll("button")).find(
      (button) => button.textContent === "儲存地區",
    )!;
    await act(async () => {
      save.click();
    });
    expect(saveSystemSettings).toHaveBeenCalledWith({ weatherLocation: "臺北" });
    const readout = harness.container.querySelector('[data-testid="weather-location-current"]');
    expect(readout?.textContent).toBe("目前地區：臺北");
  });

  async function expandAdvancedSection() {
    const toggle = Array.from(harness.container.querySelectorAll("button")).find(
      (btn) =>
        btn.getAttribute("aria-expanded") === "false" &&
        btn.getAttribute("aria-label")?.includes("進階與維運"),
    );
    expect(toggle).toBeTruthy();
    await act(async () => toggle!.click());
  }

  it("keeps everyday prefs visible while advanced ops stay collapsed", async () => {
    await harness.render(SettingsGeneralPageWithProviders);
    expect(harness.container.textContent).toContain("簡化模式");
    expect(harness.container.textContent).toContain("進階與維運");
    expect(harness.container.textContent).not.toContain("伺服器分析 Trace");
    expect(
      Array.from(harness.container.querySelectorAll("button")).some(
        (button) => button.textContent === "重啟收集器",
      ),
    ).toBe(false);
  });

  it("hosts analysis debug controls under the advanced section", async () => {
    await harness.render(SettingsGeneralPageWithProviders);
    await expandAdvancedSection();
    expect(harness.container.textContent).toContain("除錯與診斷");
    expect(harness.container.textContent).toContain("伺服器分析 Trace");
    expect(harness.container.querySelector('[data-testid="analysis-trace-verbose"]')).toBeTruthy();
  });

  it("persists analysis trace immediately when the switch is toggled", async () => {
    saveSystemSettings.mockResolvedValue({
      weatherLocation: "system",
      analysisTraceVerbose: true,
    });
    await harness.render(SettingsGeneralPageWithProviders);
    await expandAdvancedSection();
    const tile = harness.container.querySelector<HTMLElement>('[data-testid="analysis-trace-verbose"]')!;
    await act(async () => tile.click());
    expect(saveSystemSettings).toHaveBeenCalledWith({ analysisTraceVerbose: true });
    expect(applyPersistedSnapshot).toHaveBeenCalled();
  });

  it("keeps the collector restart action wired", async () => {
    await harness.render(SettingsGeneralPageWithProviders);
    await expandAdvancedSection();
    const restart = Array.from(harness.container.querySelectorAll("button")).find(
      (button) => button.textContent === "重啟收集器",
    )!;
    await act(async () => restart.click());
    const confirm = Array.from(document.body.querySelectorAll("button")).find(
      (button) => button.textContent === "確認重啟",
    )!;
    restartCollector.mockResolvedValue({ message: "已重啟" });
    await act(async () => confirm.click());
    expect(restartCollector).toHaveBeenCalledOnce();
  });
});
