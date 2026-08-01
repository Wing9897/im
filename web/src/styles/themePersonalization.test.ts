import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  applyTheme,
  applyThemePersonalization,
  formatCssColorWithOpacity,
  getCatalogColorDefaults,
  getEffectiveColorOpacity,
  getEffectiveColorPickerValues,
  getEffectivePanelOpacity,
  loadThemeColorOpacities,
  loadThemeColorOverrides,
  loadThemeTexturePref,
  normalizeHexColor,
  parseThemeTexturePref,
  resetThemePersonalization,
  saveThemeColorOverrides,
  saveThemeTexturePref,
  setThemeColorOpacity,
  setThemeColorOverride,
  storageThemeColorsKey,
  storageThemeTextureKey,
  DEFAULT_PANEL_OPACITY,
} from "./themeData";
import { getThemeDefinition } from "./themeCatalog";

function clearPersonalizationDom(): void {
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  root.removeAttribute("data-theme-mode");
  root.removeAttribute("data-theme-family");
  root.removeAttribute("data-theme-texture");
  for (const prop of [
    "--accent",
    "--surface-base",
    "--surface-card",
    "--surface-border",
    "--surface-overlay",
    "--im-panel-opacity",
    "--im-panel-opacity-pct",
  ]) {
    root.style.removeProperty(prop);
  }
}

describe("normalizeHexColor / texture pref parsing", () => {
  it("normalizes #rgb and #rrggbb", () => {
    expect(normalizeHexColor("#AbC")).toBe("#aabbcc");
    expect(normalizeHexColor("#AaBbCc")).toBe("#aabbcc");
    expect(normalizeHexColor("  #123456  ")).toBe("#123456");
  });

  it("rejects invalid colors", () => {
    expect(normalizeHexColor("red")).toBeNull();
    expect(normalizeHexColor("#12")).toBeNull();
    expect(normalizeHexColor(null)).toBeNull();
  });

  it("formats rgba when opacity is below opaque", () => {
    expect(formatCssColorWithOpacity("#112233", 1)).toBe("#112233");
    expect(formatCssColorWithOpacity("#112233", 0.5)).toBe("rgba(17, 34, 51, 0.5)");
  });

  it("parses texture prefs", () => {
    expect(parseThemeTexturePref(undefined)).toBe("default");
    expect(parseThemeTexturePref("default")).toBe("default");
    expect(parseThemeTexturePref("none")).toBe("none");
    expect(parseThemeTexturePref("moss")).toBe("moss");
    expect(parseThemeTexturePref("not-a-motif")).toBe("default");
  });
});

describe("theme personalization persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    clearPersonalizationDom();
  });

  afterEach(() => {
    localStorage.clear();
    clearPersonalizationDom();
  });

  it("stores colors/texture per theme without affecting another theme", () => {
    saveThemeColorOverrides("moss", { accent: "#112233" });
    saveThemeTexturePref("moss", "none");
    saveThemeColorOverrides("nord", { surfaceBase: "#445566" });
    saveThemeTexturePref("nord", "frost");

    expect(loadThemeColorOverrides("moss")).toEqual({ accent: "#112233" });
    expect(loadThemeTexturePref("moss")).toBe("none");
    expect(loadThemeColorOverrides("nord")).toEqual({ surfaceBase: "#445566" });
    expect(loadThemeTexturePref("nord")).toBe("frost");
    expect(localStorage.getItem(storageThemeColorsKey("moss"))).toContain("#112233");
    expect(localStorage.getItem(storageThemeColorsKey("nord"))).toContain("#445566");
  });

  it("stores per-token opacity alongside colors", () => {
    saveThemeColorOverrides("moss", { accent: "#112233" });
    setThemeColorOpacity("moss", "accent", 0.4);
    setThemeColorOpacity("moss", "surfaceCard", 0.7);

    expect(loadThemeColorOverrides("moss")).toEqual({ accent: "#112233" });
    expect(loadThemeColorOpacities("moss")).toEqual({
      accent: 0.4,
      surfaceCard: 0.7,
    });
    expect(getEffectiveColorOpacity("moss", "accent")).toBe(0.4);
    expect(getEffectiveColorOpacity("moss", "surfaceBase")).toBe(1);

    setThemeColorOpacity("moss", "accent", 1);
    expect(loadThemeColorOpacities("moss")).toEqual({ surfaceCard: 0.7 });
    expect(loadThemeColorOverrides("moss")).toEqual({ accent: "#112233" });
  });

  it("treats missing keys as default texture and empty color overrides", () => {
    expect(loadThemeColorOverrides("latte")).toEqual({});
    expect(loadThemeTexturePref("latte")).toBe("default");
  });

  it("ignores invalid stored JSON and bad hex", () => {
    localStorage.setItem(storageThemeColorsKey("moss"), "{not-json");
    expect(loadThemeColorOverrides("moss")).toEqual({});

    localStorage.setItem(
      storageThemeColorsKey("moss"),
      JSON.stringify({ accent: "nope", surfaceCard: "#abc", surfaceBase: 12 }),
    );
    expect(loadThemeColorOverrides("moss")).toEqual({ surfaceCard: "#aabbcc" });

    localStorage.setItem(storageThemeTextureKey("moss"), "bogus");
    expect(loadThemeTexturePref("moss")).toBe("default");
  });
});

describe("applyTheme personalization overlay", () => {
  beforeEach(() => {
    localStorage.clear();
    clearPersonalizationDom();
  });

  afterEach(() => {
    localStorage.clear();
    clearPersonalizationDom();
  });

  it("sets inline CSS vars from color overrides", () => {
    saveThemeColorOverrides("moss", {
      accent: "#ff0000",
      surfaceBase: "#010203",
      surfaceCard: "#040506",
    });
    applyTheme("moss");
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--accent")).toBe("#ff0000");
    expect(root.style.getPropertyValue("--surface-base")).toBe("#010203");
    expect(root.style.getPropertyValue("--surface-card")).toBe("#040506");
  });

  it("applies rgba when token opacity is set", () => {
    setThemeColorOpacity("moss", "surfaceCard", 0.55);
    applyTheme("moss");
    const defaults = getCatalogColorDefaults("moss");
    expect(document.documentElement.style.getPropertyValue("--surface-card")).toBe(
      formatCssColorWithOpacity(defaults.surfaceCard, 0.55),
    );
    expect(document.documentElement.style.getPropertyValue("--im-panel-opacity")).toBe("0.55");
    expect(document.documentElement.style.getPropertyValue("--im-panel-opacity-pct")).toBe("55%");
  });

  it("applies texture none / default / motif override", () => {
    saveThemeTexturePref("moss", "none");
    applyTheme("moss");
    expect(document.documentElement.getAttribute("data-theme-texture")).toBe("none");

    saveThemeTexturePref("moss", "default");
    applyThemePersonalization("moss");
    expect(document.documentElement.getAttribute("data-theme-texture")).toBe(
      getThemeDefinition("moss").texture ?? "none",
    );

    saveThemeTexturePref("moss", "leaf");
    applyThemePersonalization("moss");
    expect(document.documentElement.getAttribute("data-theme-texture")).toBe("leaf");
  });

  it("clears theme A inline vars when switching to theme B without overrides", () => {
    saveThemeColorOverrides("moss", {
      accent: "#ff0000",
      surfaceBase: "#111111",
      surfaceCard: "#222222",
    });
    applyTheme("moss");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#ff0000");

    applyTheme("nord");
    expect(document.documentElement.getAttribute("data-theme")).toBe("nord");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--surface-base")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--surface-card")).toBe("");
    expect(document.documentElement.getAttribute("data-theme-texture")).toBe(
      getThemeDefinition("nord").texture ?? "none",
    );
  });

  it("applies theme B overrides after switching from A", () => {
    saveThemeColorOverrides("moss", { accent: "#aa0000" });
    saveThemeTexturePref("moss", "none");
    saveThemeColorOverrides("nord", { accent: "#00bb00" });
    saveThemeTexturePref("nord", "wave");

    applyTheme("moss");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#aa0000");
    expect(document.documentElement.getAttribute("data-theme-texture")).toBe("none");

    applyTheme("nord");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#00bb00");
    expect(document.documentElement.getAttribute("data-theme-texture")).toBe("wave");
  });

  it("reset clears only that theme and restores catalog DOM", () => {
    saveThemeColorOverrides("moss", { accent: "#ff00aa" });
    setThemeColorOpacity("moss", "accent", 0.5);
    saveThemeTexturePref("moss", "none");
    saveThemeColorOverrides("nord", { accent: "#00ffaa" });
    applyTheme("moss");

    resetThemePersonalization("moss");
    expect(localStorage.getItem(storageThemeColorsKey("moss"))).toBeNull();
    expect(localStorage.getItem(storageThemeTextureKey("moss"))).toBeNull();
    expect(localStorage.getItem(storageThemeColorsKey("nord"))).not.toBeNull();
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("");
    expect(document.documentElement.getAttribute("data-theme-texture")).toBe(
      getThemeDefinition("moss").texture ?? "none",
    );
  });

  it("setThemeColorOverride updates storage and effective picker values", () => {
    const defaults = getCatalogColorDefaults("moss");
    expect(getEffectiveColorPickerValues("moss").accent).toBe(defaults.accent);

    setThemeColorOverride("moss", "accent", "#abcdef");
    expect(loadThemeColorOverrides("moss").accent).toBe("#abcdef");
    expect(getEffectiveColorPickerValues("moss").accent).toBe("#abcdef");

    setThemeColorOverride("moss", "accent", null);
    expect(loadThemeColorOverrides("moss").accent).toBeUndefined();
    expect(getEffectiveColorPickerValues("moss").accent).toBe(defaults.accent);
  });

  it("keeps baseline applyTheme attrs when no prefs exist", () => {
    applyTheme("moss");
    expect(document.documentElement.getAttribute("data-theme")).toBe("moss");
    expect(document.documentElement.getAttribute("data-theme-texture")).toBe("moss");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("");
  });

  it("panel opacity follows only surfaceCard after hard-cut", () => {
    expect(getEffectivePanelOpacity("moss")).toBe(DEFAULT_PANEL_OPACITY);
    setThemeColorOpacity("moss", "surfaceCard", 0.7);
    expect(getEffectivePanelOpacity("moss")).toBe(0.7);
    applyThemePersonalization("moss");
    expect(document.documentElement.style.getPropertyValue("--im-panel-opacity")).toBe("0.7");
  });
});
