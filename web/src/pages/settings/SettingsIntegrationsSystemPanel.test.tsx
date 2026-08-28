import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { MAP_CARTO_API_KEY_STORAGE_KEY } from "../../domain/prefs";
import { CARTO_URL } from "../../domain/intelligence/mapTiles";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";
import { SettingsIntegrationsSystemPanel } from "./SettingsIntegrationsSystemPanel";

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

describe("SettingsIntegrationsSystemPanel", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    await i18n.changeLanguage("zh-Hant");
    harness = createTestHarness();
    window.localStorage.clear();
  });

  afterEach(() => {
    harness.cleanup();
    window.localStorage.clear();
  });

  it("hosts a CARTO basemap API key field on the system integrations tab", async () => {
    await harness.render(SettingsIntegrationsSystemPanel);

    const card = harness.container.querySelector('[data-testid="integrations-system-carto-card"]');
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain("地圖底圖／CARTO API 金鑰");
    const input = harness.container.querySelector('[data-testid="carto-api-key"]');
    expect(input).not.toBeNull();
    const docs = harness.container.querySelector<HTMLAnchorElement>('[data-testid="carto-api-key-docs"]');
    expect(docs?.href).toBe("https://carto.com/basemaps/apikey");
  });

  it("persists the CARTO API key on this device and reloads it", async () => {
    await harness.render(SettingsIntegrationsSystemPanel);
    const input = harness.container.querySelector<HTMLInputElement>('[data-testid="carto-api-key"]')!;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      nativeInputValueSetter.call(input, "  carto-test-key  ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const save = harness.container.querySelector<HTMLButtonElement>(
      '[data-testid="save-carto-api-key"]',
    )!;
    await act(async () => {
      save.click();
    });
    expect(localStorage.getItem(MAP_CARTO_API_KEY_STORAGE_KEY)).toBe("carto-test-key");

    harness.cleanup();
    harness = createTestHarness();
    await harness.render(SettingsIntegrationsSystemPanel);
    const reloaded = harness.container.querySelector<HTMLInputElement>(
      '[data-testid="carto-api-key"]',
    )!;
    expect(reloaded.value).toBe("carto-test-key");
  });

  it("shows a read-only outbound URL list from the SoT", async () => {
    await harness.render(SettingsIntegrationsSystemPanel);

    const list = harness.container.querySelector('[data-testid="integrations-system-outbound-list"]');
    expect(list).not.toBeNull();
    expect(
      harness.container.querySelector('[data-testid="integrations-system-outbound-url-carto-tiles"]')
        ?.textContent,
    ).toBe(CARTO_URL);
    expect(
      harness.container.querySelector(
        '[data-testid="integrations-system-outbound-url-open-meteo-geocoding"]',
      )?.textContent,
    ).toBe("https://geocoding-api.open-meteo.com/v1/search");
    expect(
      harness.container.querySelector(
        '[data-testid="integrations-system-outbound-url-nager-holidays"]',
      )?.textContent,
    ).toContain("date.nager.at");
    expect(harness.container.textContent).toContain("Open-Meteo 地理編碼");
    expect(harness.container.textContent).toContain("Nager.Date 公眾假期");
    expect(harness.container.textContent).toContain("MET Norway 天氣（備援）");
    expect(harness.container.textContent).toContain("wttr.in 天氣（最後備援）");
    expect(harness.container.textContent).toContain("Nominatim 地理編碼（OSM）");
    expect(harness.container.textContent).toContain("Bing 每日桌布");
    expect(
      harness.container.querySelector(
        '[data-testid="integrations-system-outbound-url-met-no-forecast"]',
      )?.textContent,
    ).toBe("https://api.met.no/weatherapi/locationforecast/2.0/compact");
    expect(
      harness.container.querySelector(
        '[data-testid="integrations-system-outbound-url-wttr-weather"]',
      )?.textContent,
    ).toBe("https://wttr.in/{location}");
    expect(
      harness.container.querySelector(
        '[data-testid="integrations-system-outbound-url-nominatim-geocoding"]',
      )?.textContent,
    ).toBe("https://nominatim.openstreetmap.org/search");
    expect(
      harness.container.querySelector(
        '[data-testid="integrations-system-outbound-url-bing-focal-background"]',
      )?.textContent,
    ).toBe("https://www.bing.com/HPImageArchive.aspx");
  });
});
