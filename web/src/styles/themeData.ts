import {
  STORAGE_KEY_THEME,
  storageBgKey,
  storageBgOpacityKey,
  storageThemeColorsKey,
  storageThemeTextureKey,
} from "../domain/prefs";
import {
  LIGHT_THEME_IDS,
  THEME_CATALOG,
  getThemeDefinition,
  resolveThemeId,
  type ThemeDefinition,
  type ThemeFamily,
} from "./themeCatalog";
import { applyThemePersonalization } from "./themePersonalization";

export {
  STORAGE_KEY_THEME,
  storageBgKey,
  storageBgOpacityKey,
  storageThemeColorsKey,
  storageThemeTextureKey,
};
export {
  DEFAULT_THEME_ID,
  LEGACY_THEME_REMAP,
  resolveThemeId,
  getThemeDefinition,
  THEME_CATALOG,
  THEME_IDS,
  THEME_MOTIFS,
  SPECIAL_THEME_IDS,
} from "./themeCatalog";
export type { ThemeMotif, ThemeTexture } from "./themeCatalog";
export {
  applyThemePersonalization,
  getCatalogColorDefaults,
  getEffectiveColorOpacity,
  getEffectiveColorOpacityMap,
  getEffectiveColorPickerValues,
  getEffectivePanelOpacity,
  getEffectiveTexture,
  loadThemeColorOpacities,
  loadThemeColorOverrides,
  loadThemeTexturePref,
  resetThemePersonalization,
  saveThemeColorOpacities,
  saveThemeColorOverrides,
  saveThemeTexturePref,
  setThemeColorOpacity,
  setThemeColorOverride,
  THEME_COLOR_OVERRIDE_KEYS,
  DEFAULT_COLOR_OPACITY,
  MIN_COLOR_OPACITY,
  MAX_COLOR_OPACITY,
  DEFAULT_PANEL_OPACITY,
  normalizeHexColor,
  formatCssColorWithOpacity,
  parseThemeTexturePref,
  clampColorOpacity,
} from "./themePersonalization";
export type {
  ThemeColorOverrideKey,
  ThemeColorOverrides,
  ThemeColorOpacityMap,
  ThemeTexturePref,
} from "./themePersonalization";

export interface ThemeEntry {
  id: string;
  name: string;
  colors: string[];
  light?: boolean;
  special?: boolean;
  family: ThemeFamily;
  gradient?: string;
}

function toThemeEntry(def: ThemeDefinition): ThemeEntry {
  return {
    id: def.id,
    name: def.name,
    colors: [...def.swatch],
    light: def.light,
    special: def.special,
    family: def.family,
    gradient: def.gradient,
  };
}

/** Picker / UI theme list — derived from catalog swatches (SoT). */
export const THEMES: ThemeEntry[] = THEME_CATALOG.map(toThemeEntry);

/** Apply theme to DOM and persist to localStorage */
export function applyTheme(themeId: string): void {
  const id = resolveThemeId(themeId);
  const def = getThemeDefinition(id);
  const root = document.documentElement;
  root.setAttribute("data-theme", id);
  root.setAttribute("data-theme-mode", LIGHT_THEME_IDS.has(id) ? "light" : "dark");
  root.setAttribute("data-theme-family", def.family);
  root.setAttribute("data-theme-texture", def.texture ?? "none");
  // Custom photo BG (any theme) sets data-theme-bg=custom and pauses page texture.
  if (root.getAttribute("data-theme-bg") !== "custom") {
    root.setAttribute("data-theme-bg", "none");
  }
  localStorage.setItem(STORAGE_KEY_THEME, id);
  applyThemePersonalization(id);
}

/** Read stored theme ID from localStorage; remaps legacy IDs; falls back to default. */
export function getStoredThemeId(): string {
  const stored = localStorage.getItem(STORAGE_KEY_THEME);
  const resolved = resolveThemeId(stored);
  // Persist remap so subsequent reads stay on the new id
  if (stored && stored !== resolved) {
    localStorage.setItem(STORAGE_KEY_THEME, resolved);
  }
  return resolved;
}

/** Apply background image + opacity to the DOM */
export function applyBgImage(url: string | null, opacity: number): void {
  const root = document.documentElement;
  let el = document.getElementById("im-theme-bg");
  if (!url) {
    if (el) el.style.display = "none";
    root.setAttribute("data-theme-bg", "none");
    return;
  }
  if (!el) {
    el = document.createElement("div");
    el.id = "im-theme-bg";
    Object.assign(el.style, {
      position: "fixed",
      inset: "0",
      zIndex: "0",
      pointerEvents: "none",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    });
    document.body.prepend(el);
  }
  el.style.display = "block";
  el.style.backgroundImage = `url("${url}")`;
  el.style.opacity = String(opacity);
  root.setAttribute("data-theme-bg", "custom");
}

/** Load background image from localStorage and apply to DOM (any theme). */
export function loadBgForTheme(themeId: string): string | null {
  const id = resolveThemeId(themeId);
  const dataUrl = localStorage.getItem(storageBgKey(id));
  const opacity = parseFloat(localStorage.getItem(storageBgOpacityKey(id)) || "0.3");
  if (dataUrl) {
    applyBgImage(dataUrl, opacity);
    return dataUrl;
  }
  applyBgImage(null, 0);
  return null;
}
