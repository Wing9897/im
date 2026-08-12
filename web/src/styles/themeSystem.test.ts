import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  THEMES,
  DEFAULT_THEME_ID,
  STORAGE_KEY_THEME,
  storageBgKey,
  storageBgOpacityKey,
  applyTheme,
  getStoredThemeId,
  applyBgImage,
  loadBgForTheme,
  resolveThemeId,
} from "./themeData";
import { storageBgModeKey } from "../domain/prefs";
import { THEME_CATALOG, SPECIAL_THEME_IDS } from "./themeCatalog";

/**
 * Unit tests for Theme System utilities (themeData / themeCatalog / tokens).
 */

describe("theme catalog contract", () => {
  it("exposes exactly 20 themes", () => {
    expect(THEME_CATALOG).toHaveLength(20);
    expect(THEMES).toHaveLength(20);
  });

  it("covers required ids", () => {
    const ids = THEME_CATALOG.map((t) => t.id);
    expect(ids).toEqual([
      "command-center",
      "latte",
      "nord",
      "sumi",
      "washi",
      "moss",
      "harbor",
      "ember",
      "clay",
      "orchard",
      "mist",
      "copper",
      "slate",
      "obsidian",
      "reef",
      "cedar",
      "porcelain",
      "volt",
      "cyberpunk",
      "sakura",
    ]);
  });

  it("derives picker swatches from catalog", () => {
    for (const entry of THEMES) {
      const def = THEME_CATALOG.find((t) => t.id === entry.id)!;
      expect(entry.colors).toEqual([...def.swatch]);
      expect(entry.family).toBe(def.family);
    }
  });

  it("assigns selective textures (not flat mono for crafted themes)", () => {
    expect(THEME_CATALOG.find((t) => t.id === "sumi")?.texture).toBe("ink");
    expect(THEME_CATALOG.find((t) => t.id === "washi")?.texture).toBe("washi");
    expect(THEME_CATALOG.find((t) => t.id === "moss")?.texture).toBe("moss");
    expect(THEME_CATALOG.find((t) => t.id === "orchard")?.texture).toBe("leaf");
    expect(THEME_CATALOG.find((t) => t.id === "harbor")?.texture).toBe("wave");
    expect(THEME_CATALOG.find((t) => t.id === "nord")?.texture).toBe("frost");
    expect(THEME_CATALOG.find((t) => t.id === "ember")?.texture).toBe("ember");
    expect(THEME_CATALOG.find((t) => t.id === "clay")?.texture).toBe("dune");
    expect(THEME_CATALOG.find((t) => t.id === "copper")?.texture).toBe("wood");
    expect(THEME_CATALOG.find((t) => t.id === "mist")?.texture).toBe("mist");
    expect(THEME_CATALOG.find((t) => t.id === "sakura")?.texture).toBe("petal");
    expect(THEME_CATALOG.find((t) => t.id === "cyberpunk")?.texture).toBe("grid");
  });
});

describe("applyTheme sets DOM attribute and localStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-mode");
    document.documentElement.removeAttribute("data-theme-family");
    document.documentElement.removeAttribute("data-theme-texture");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-mode");
    document.documentElement.removeAttribute("data-theme-family");
    document.documentElement.removeAttribute("data-theme-texture");
  });

  it("sets data-theme attribute for a valid theme ID", () => {
    applyTheme("moss");
    expect(document.documentElement.getAttribute("data-theme")).toBe("moss");
    expect(document.documentElement.getAttribute("data-theme-mode")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme-family")).toBe("classic");
    expect(document.documentElement.getAttribute("data-theme-texture")).toBe("moss");
  });

  it("persists theme ID to localStorage", () => {
    applyTheme("nord");
    expect(localStorage.getItem(STORAGE_KEY_THEME)).toBe("nord");
  });

  it("works for multiple different valid theme IDs", () => {
    const testIds = ["latte", "nord", "sumi", "washi", "harbor", "ember", "orchard", "mist", "sakura"];
    for (const id of testIds) {
      applyTheme(id);
      expect(document.documentElement.getAttribute("data-theme")).toBe(id);
      expect(localStorage.getItem(STORAGE_KEY_THEME)).toBe(id);
      expect(document.documentElement.getAttribute("data-theme-mode")).toBe(
        id === "latte" || id === "washi" || id === "orchard" || id === "mist" ? "light" : "dark",
      );
    }
  });

  it("marks light themes with data-theme-mode=light", () => {
    applyTheme("latte");
    expect(document.documentElement.getAttribute("data-theme-mode")).toBe("light");
    applyTheme("washi");
    expect(document.documentElement.getAttribute("data-theme-mode")).toBe("light");
    applyTheme("orchard");
    expect(document.documentElement.getAttribute("data-theme-mode")).toBe("light");
    applyTheme("mist");
    expect(document.documentElement.getAttribute("data-theme-mode")).toBe("light");
  });

  it("sets data-theme-family for desk / classic / special", () => {
    applyTheme("command-center");
    expect(document.documentElement.getAttribute("data-theme-family")).toBe("desk");
    applyTheme("nord");
    expect(document.documentElement.getAttribute("data-theme-family")).toBe("classic");
    applyTheme("sakura");
    expect(document.documentElement.getAttribute("data-theme-family")).toBe("special");
  });

  it("falls back to default for unknown theme ids", () => {
    applyTheme("mocha");
    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME_ID);
    applyTheme("nonexistent-theme");
    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME_ID);
    expect(localStorage.getItem(STORAGE_KEY_THEME)).toBe(DEFAULT_THEME_ID);
  });

  it("sets data-theme-bg none without custom photo, custom when photo applied", () => {
    applyTheme("moss");
    applyBgImage(null, 0);
    expect(document.documentElement.getAttribute("data-theme-bg")).toBe("none");
    applyBgImage("data:image/png;base64,AAAA", 0.3);
    expect(document.documentElement.getAttribute("data-theme-bg")).toBe("custom");
    applyBgImage(null, 0);
    expect(document.documentElement.getAttribute("data-theme-bg")).toBe("none");
  });

  it("sets data-theme-bg focal for Bing daily photo and preserves it across applyTheme", () => {
    applyTheme("moss");
    applyBgImage("https://www.bing.com/th?id=OHR.Test", 0.3, "focal");
    expect(document.documentElement.getAttribute("data-theme-bg")).toBe("focal");
    applyTheme("nord");
    expect(document.documentElement.getAttribute("data-theme-bg")).toBe("focal");
  });
});

describe("resolveThemeId unknown → default", () => {
  it("returns catalog ids unchanged and unknown ids as default", () => {
    expect(resolveThemeId("nord")).toBe("nord");
    expect(resolveThemeId("sakura")).toBe("sakura");
    expect(resolveThemeId("mocha")).toBe(DEFAULT_THEME_ID);
    expect(resolveThemeId("dracula")).toBe(DEFAULT_THEME_ID);
    expect(resolveThemeId("invalid-theme")).toBe(DEFAULT_THEME_ID);
    expect(resolveThemeId("")).toBe(DEFAULT_THEME_ID);
    expect(resolveThemeId(null)).toBe(DEFAULT_THEME_ID);
    expect(resolveThemeId(undefined)).toBe(DEFAULT_THEME_ID);
  });
});

describe("getStoredThemeId fallback mechanism", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns the stored value when it is a valid theme ID", () => {
    localStorage.setItem(STORAGE_KEY_THEME, "nord");
    expect(getStoredThemeId()).toBe("nord");

    localStorage.setItem(STORAGE_KEY_THEME, "sakura");
    expect(getStoredThemeId()).toBe("sakura");
  });

  it("returns default for unknown stored values without rewriting storage", () => {
    localStorage.setItem(STORAGE_KEY_THEME, "dracula");
    expect(getStoredThemeId()).toBe(DEFAULT_THEME_ID);
    expect(localStorage.getItem(STORAGE_KEY_THEME)).toBe("dracula");

    localStorage.setItem(STORAGE_KEY_THEME, "invalid-theme");
    expect(getStoredThemeId()).toBe(DEFAULT_THEME_ID);

    localStorage.setItem(STORAGE_KEY_THEME, "");
    expect(getStoredThemeId()).toBe(DEFAULT_THEME_ID);

    localStorage.setItem(STORAGE_KEY_THEME, "MOCHA");
    expect(getStoredThemeId()).toBe(DEFAULT_THEME_ID);
  });

  it("returns default theme when nothing is stored", () => {
    expect(getStoredThemeId()).toBe(DEFAULT_THEME_ID);
  });
});

describe("special theme classification consistency", () => {
  it("SPECIAL_THEME_IDS match entry.special for every theme", () => {
    for (const entry of THEMES) {
      expect(SPECIAL_THEME_IDS.has(entry.id)).toBe(entry.special === true);
    }
  });

  it("known special themes are in SPECIAL_THEME_IDS", () => {
    expect(SPECIAL_THEME_IDS.has("sakura")).toBe(true);
    expect(SPECIAL_THEME_IDS.has("cyberpunk")).toBe(true);
    expect(SPECIAL_THEME_IDS.has("volt")).toBe(true);
  });

  it("known non-special themes are not in SPECIAL_THEME_IDS", () => {
    expect(SPECIAL_THEME_IDS.has("latte")).toBe(false);
    expect(SPECIAL_THEME_IDS.has("nord")).toBe(false);
    expect(SPECIAL_THEME_IDS.has("command-center")).toBe(false);
    expect(SPECIAL_THEME_IDS.has("moss")).toBe(false);
    expect(SPECIAL_THEME_IDS.has("sumi")).toBe(false);
  });
});

describe("applyBgImage CSS variable apply path", () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty("--theme-bg-image");
    document.documentElement.style.removeProperty("--theme-bg-wash-pct");
    document.documentElement.removeAttribute("data-theme-bg");
  });

  afterEach(() => {
    document.documentElement.style.removeProperty("--theme-bg-image");
    document.documentElement.style.removeProperty("--theme-bg-wash-pct");
    document.documentElement.removeAttribute("data-theme-bg");
  });

  it("sets --theme-bg-image and wash pct from URL + opacity", () => {
    applyBgImage("https://example.com/bg.png", 0.3);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--theme-bg-image")).toContain(
      "https://example.com/bg.png",
    );
    expect(root.style.getPropertyValue("--theme-bg-wash-pct")).toBe("62%");
    expect(root.getAttribute("data-theme-bg")).toBe("custom");
  });

  it("updates CSS vars in place for successive applies", () => {
    applyBgImage("url-one", 0.2);
    applyBgImage("url-two", 0.5);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--theme-bg-image")).toContain("url-two");
    expect(root.style.getPropertyValue("--theme-bg-wash-pct")).toBe("42%");
  });

  it("clears CSS vars when URL is null", () => {
    applyBgImage("test-url", 0.3);
    applyBgImage(null, 0);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--theme-bg-image")).toBe("");
    expect(root.style.getPropertyValue("--theme-bg-wash-pct")).toBe("");
    expect(root.getAttribute("data-theme-bg")).toBe("none");
  });

  it("handles data URL strings via CSS vars", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
    applyBgImage(dataUrl, 0.4, "custom");
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--theme-bg-image")).toContain(dataUrl);
    expect(root.style.getPropertyValue("--theme-bg-wash-pct")).toBe("52%");
  });

  it("writes focal mode attribute and max-opacity wash for Bing URL", () => {
    applyBgImage("https://www.bing.com/th?id=OHR.Test", 0.6, "focal");
    const root = document.documentElement;
    expect(root.getAttribute("data-theme-bg")).toBe("focal");
    expect(root.style.getPropertyValue("--theme-bg-image")).toContain("bing.com");
    expect(root.style.getPropertyValue("--theme-bg-wash-pct")).toBe("40%");
  });
});

describe("loadBgForTheme load and hide behavior", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty("--theme-bg-image");
    document.documentElement.style.removeProperty("--theme-bg-wash-pct");
    document.documentElement.removeAttribute("data-theme-bg");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty("--theme-bg-image");
    document.documentElement.style.removeProperty("--theme-bg-wash-pct");
    document.documentElement.removeAttribute("data-theme-bg");
  });

  it("returns null and clears photo vars when no image is stored (any theme)", () => {
    const ids = [
      "command-center",
      "latte",
      "nord",
      "moss",
      "orchard",
      "sakura",
    ];
    for (const id of ids) {
      const result = loadBgForTheme(id);
      expect(result).toBeNull();
      expect(document.documentElement.getAttribute("data-theme-bg")).toBe("none");
    }
  });

  it("returns stored data URL and applies CSS vars with stored opacity", () => {
    const themeId = "orchard";
    const fakeDataUrl = "data:image/png;base64,orchardAAAA";
    const opacity = 0.25;

    localStorage.setItem(storageBgKey(themeId), fakeDataUrl);
    localStorage.setItem(storageBgOpacityKey(themeId), String(opacity));

    const result = loadBgForTheme(themeId);
    expect(result).toBe(fakeDataUrl);

    const root = document.documentElement;
    expect(root.getAttribute("data-theme-bg")).toBe("custom");
    expect(root.style.getPropertyValue("--theme-bg-image")).toContain(fakeDataUrl);
    expect(root.style.getPropertyValue("--theme-bg-wash-pct")).toBe("67%");
  });

  it("returns null for theme with no stored data URL", () => {
    const result = loadBgForTheme("cyberpunk");
    expect(result).toBeNull();
  });

  it("uses default opacity 0.3 wash when no opacity is stored", () => {
    const themeId = "moss";
    const fakeDataUrl = "data:image/png;base64,mossAAAA";

    localStorage.setItem(storageBgKey(themeId), fakeDataUrl);

    const result = loadBgForTheme(themeId);
    expect(result).toBe(fakeDataUrl);

    expect(document.documentElement.style.getPropertyValue("--theme-bg-wash-pct")).toBe(
      "62%",
    );
  });

  it("applies focal cache URL to CSS vars immediately", () => {
    const themeId = "latte";
    localStorage.setItem(storageBgModeKey(themeId), "focal");
    localStorage.setItem(
      "im:theme-focal-cache",
      JSON.stringify({
        day: "2099-01-01",
        locale: "en",
        imageUrl: "https://www.bing.com/th?id=OHR.CachedApply",
        title: "Cached",
        copyright: "Cached",
      }),
    );
    localStorage.setItem(storageBgOpacityKey(themeId), "0.6");

    const result = loadBgForTheme(themeId);
    expect(result).toContain("OHR.CachedApply");
    const root = document.documentElement;
    expect(root.getAttribute("data-theme-bg")).toBe("focal");
    expect(root.style.getPropertyValue("--theme-bg-image")).toContain("OHR.CachedApply");
    expect(root.style.getPropertyValue("--theme-bg-wash-pct")).toBe("40%");
  });
});

describe("dark theme luminance hierarchy", () => {
  function parseHex(hex: string): [number, number, number] {
    const h = hex.replace("#", "");
    if (h.length === 3) {
      return [
        parseInt(h[0] + h[0], 16),
        parseInt(h[1] + h[1], 16),
        parseInt(h[2] + h[2], 16),
      ];
    }
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }

  function relativeLuminance(hex: string): number {
    const [r, g, b] = parseHex(hex).map((c) => {
      const sRGB = c / 255;
      return sRGB <= 0.03928
        ? sRGB / 12.92
        : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrastRatio(fg: string, bg: string): number {
    const L1 = relativeLuminance(fg);
    const L2 = relativeLuminance(bg);
    const lighter = Math.max(L1, L2);
    const darker = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  const DARK_THEME_CONFIGS = THEME_CATALOG.filter((t) => !t.light).map((t) => ({
    name: t.id,
    statNumber: t.colors.textPrimary,
    statLabel: t.colors.textSecondary,
    statAux: t.colors.textMuted,
    subtle: t.colors.textSubtle,
    card: t.colors.surfaceCard,
    base: t.colors.surfaceBase,
  }));

  it("luminance(stat-number) > luminance(stat-label) > luminance(stat-aux) for all dark themes", () => {
    for (const theme of DARK_THEME_CONFIGS) {
      if (!theme.statNumber.startsWith("#")) continue;
      const lumNumber = relativeLuminance(theme.statNumber);
      const lumLabel = relativeLuminance(theme.statLabel);
      const lumAux = relativeLuminance(theme.statAux);
      const lumSubtle = relativeLuminance(theme.subtle);

      expect(lumNumber, `${theme.name}: primary > secondary`).toBeGreaterThan(lumLabel);
      expect(lumLabel, `${theme.name}: secondary > muted`).toBeGreaterThan(lumAux);
      expect(lumAux, `${theme.name}: muted > subtle`).toBeGreaterThan(lumSubtle);
    }
  });

  it("primary text on surface-card meets ~AA (≥4.5) for solid dark themes", () => {
    for (const theme of DARK_THEME_CONFIGS) {
      if (!theme.card.startsWith("#") || !theme.statNumber.startsWith("#")) continue;
      const ratio = contrastRatio(theme.statNumber, theme.card);
      expect(ratio, `${theme.name}: primary on card ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("secondary text on surface-card meets large-text AA (≥3) for solid dark themes", () => {
    for (const theme of DARK_THEME_CONFIGS) {
      if (!theme.card.startsWith("#") || !theme.statLabel.startsWith("#")) continue;
      const ratio = contrastRatio(theme.statLabel, theme.card);
      expect(ratio, `${theme.name}: secondary on card ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("surface card is clearly lifted above base (luminance delta)", () => {
    for (const theme of DARK_THEME_CONFIGS) {
      if (!theme.card.startsWith("#") || !theme.base.startsWith("#")) continue;
      const delta = relativeLuminance(theme.card) - relativeLuminance(theme.base);
      expect(delta, `${theme.name}: card should be brighter than base`).toBeGreaterThan(0.008);
    }
  });
});

import { shadow, duration, easing } from "./tokens";
import type { ShadowKey, EasingKey } from "./tokens";

const SHADOW_KEYS: readonly ShadowKey[] = ["sm", "md", "lg", "xl"] as const;
const EASING_KEYS: readonly EasingKey[] = ["default", "out", "spring", "linear"] as const;


const CSS_TIMING_FUNCTION_REGEX =
  /^(cubic-bezier\(\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*\)|linear|ease|ease-in|ease-out|ease-in-out)$/;

describe("Shadow token structure completeness", () => {
  it("shadow object contains exactly 4 keys", () => {
    expect(Object.keys(shadow)).toHaveLength(4);
  });

  it("every shadow key exists and its value is a non-empty string containing 'var(--shadow-'", () => {
    for (const key of SHADOW_KEYS) {
      const value = shadow[key];
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
      expect(value).toContain("var(--shadow-");
    }
  });
});

describe("Duration token value range constraints", () => {
  it("fast duration is between 100 and 150 (inclusive)", () => {
    expect(duration.fast).toBeGreaterThanOrEqual(100);
    expect(duration.fast).toBeLessThanOrEqual(150);
  });

  it("normal duration is between 100 and 280 (inclusive)", () => {
    expect(duration.normal).toBeGreaterThanOrEqual(100);
    expect(duration.normal).toBeLessThanOrEqual(280);
  });

  it("slow duration is between 300 and 400 (inclusive)", () => {
    expect(duration.slow).toBeGreaterThanOrEqual(300);
    expect(duration.slow).toBeLessThanOrEqual(400);
  });

  it("ordering invariant: fast < normal < slow", () => {
    expect(duration.fast).toBeLessThan(duration.normal);
    expect(duration.normal).toBeLessThan(duration.slow);
  });
});

describe("Easing token validity", () => {
  it("every easing value is a valid CSS timing function string", () => {
    for (const key of EASING_KEYS) {
      const value = easing[key];
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
      expect(value).toMatch(CSS_TIMING_FUNCTION_REGEX);
    }
  });
});
