import {
  STORAGE_KEY_THEME,
  storageBgKey,
  storageBgOpacityKey,
  storageThemeColorsKey,
  storageThemeTextureKey,
} from "../domain/prefs";
import { getAppLocale } from "../i18n/locale";
import {
  LIGHT_THEME_IDS,
  THEME_CATALOG,
  getThemeDefinition,
  resolveThemeId,
  type ThemeDefinition,
  type ThemeFamily,
} from "./themeCatalog";
import { applyThemePersonalization } from "./themePersonalization";
import {
  cssBackgroundImageUrl,
  loadBgOpacity,
  loadFocalCache,
  materializeFocalApplyUrl,
  pickFocalUrlForApply,
  resolveThemeBgMode,
  saveThemeBgMode,
  themeBgWashPct,
  type ThemeBgMode,
  utcDayIso,
} from "./themeBg";

export {
  STORAGE_KEY_THEME,
  storageBgKey,
  storageBgOpacityKey,
  storageThemeColorsKey,
  storageThemeTextureKey,
};
export {
  DEFAULT_THEME_ID,
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
  PHOTO_SURFACE_PANEL_FLOOR,
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
export {
  parseThemeBgMode,
  resolveThemeBgMode,
  saveThemeBgMode,
  loadBgOpacity,
  loadFocalCache,
  saveFocalCache,
  refreshFocalBackground,
  advanceFocalBackground,
  advanceAndMaterializeFocal,
  materializeFocalApplyUrl,
  cssBackgroundImageUrl,
  themeBgWashPct,
  clampFocalIdx,
  nextFocalIdx,
  loadFocalRefreshHours,
  saveFocalRefreshHours,
  parseFocalRefreshHours,
  isFocalRefreshDue,
  FOCAL_REFRESH_HOUR_OPTIONS,
  type ThemeBgMode,
  type FocalCacheEntry,
  type FocalRefreshHours,
} from "./themeBg";

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

const PHOTO_BG_MODES = new Set<ThemeBgMode>(["custom", "focal"]);

/** Apply theme to DOM and persist to localStorage */
export function applyTheme(themeId: string): void {
  const id = resolveThemeId(themeId);
  const def = getThemeDefinition(id);
  const root = document.documentElement;
  root.setAttribute("data-theme", id);
  root.setAttribute("data-theme-mode", LIGHT_THEME_IDS.has(id) ? "light" : "dark");
  root.setAttribute("data-theme-family", def.family);
  root.setAttribute("data-theme-texture", def.texture ?? "none");
  // Photo BG (custom upload or focal) sets data-theme-bg and pauses page texture.
  const bg = root.getAttribute("data-theme-bg");
  if (bg !== "custom" && bg !== "focal") {
    root.setAttribute("data-theme-bg", "none");
  }
  localStorage.setItem(STORAGE_KEY_THEME, id);
  applyThemePersonalization(id);
}

/** Read stored theme ID from localStorage; unknown → default (no remap persist). */
export function getStoredThemeId(): string {
  return resolveThemeId(localStorage.getItem(STORAGE_KEY_THEME));
}

/**
 * Apply background image + opacity via CSS vars on ``html``.
 * Painted into ``.im-page-canvas`` (theme-textures.css). Overlay sidebar is translucent.
 * ``mode`` defaults to ``custom`` when a URL is set (upload path).
 */
export function applyBgImage(
  url: string | null,
  opacity: number,
  mode: ThemeBgMode = "custom",
): void {
  const root = document.documentElement;

  if (!url || mode === "none") {
    root.style.removeProperty("--theme-bg-image");
    root.style.removeProperty("--theme-bg-wash-pct");
    root.setAttribute("data-theme-bg", "none");
    return;
  }
  root.style.setProperty("--theme-bg-image", cssBackgroundImageUrl(url));
  root.style.setProperty("--theme-bg-wash-pct", themeBgWashPct(opacity));
  root.setAttribute("data-theme-bg", PHOTO_BG_MODES.has(mode) ? mode : "custom");
}

/**
 * Load background for a theme: none / custom upload / focal (Bing daily).
 * Focal applies last-known cache immediately, then materializes proxy bytes.
 */
export function loadBgForTheme(themeId: string): string | null {
  const id = resolveThemeId(themeId);
  const mode = resolveThemeBgMode(id);
  const opacity = loadBgOpacity(id);

  if (mode === "none") {
    applyBgImage(null, 0, "none");
    return null;
  }

  if (mode === "custom") {
    const dataUrl = localStorage.getItem(storageBgKey(id));
    if (dataUrl) {
      applyBgImage(dataUrl, opacity, "custom");
      return dataUrl;
    }
    applyBgImage(null, 0, "none");
    return null;
  }

  // focal
  const locale = getAppLocale();
  const cache = loadFocalCache();
  const url = pickFocalUrlForApply(cache, locale, utcDayIso());
  if (url) {
    applyBgImage(url, opacity, "focal");
  } else {
    applyBgImage(null, 0, "none");
    // While waiting with no cache, leave data-theme-bg=none so motif shows.
  }

  const idx =
    cache && cache.day === utcDayIso() && cache.locale === locale
      ? cache.idx
      : 0;
  void materializeFocalApplyUrl({ locale, idx }).then((applyUrl) => {
    if (resolveThemeBgMode(id) !== "focal") return;
    if (resolveThemeId(localStorage.getItem(STORAGE_KEY_THEME)) !== id) return;
    if (applyUrl) {
      applyBgImage(applyUrl, loadBgOpacity(id), "focal");
    }
  });

  return url;
}

/** Persist mode and apply (custom keeps upload; focal triggers refresh). */
export function setThemeBgMode(themeId: string, mode: ThemeBgMode): void {
  const id = resolveThemeId(themeId);
  saveThemeBgMode(id, mode);
  loadBgForTheme(id);
}
