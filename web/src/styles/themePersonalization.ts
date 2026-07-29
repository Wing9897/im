import {
  STORAGE_KEY_THEME_PANEL_OPACITY_MIGRATED,
  storageThemeColorsKey,
  storageThemePanelOpacityKey,
  storageThemeTextureKey,
} from "./themePersistedKeys";
import {
  THEME_CATALOG,
  THEME_MOTIFS,
  getThemeDefinition,
  resolveThemeId,
  type ThemeMotif,
} from "./themeCatalog";

/** User-customizable CSS color tokens (camelCase prefs → kebab CSS vars). */
export type ThemeColorOverrides = {
  accent?: string;
  surfaceBase?: string;
  surfaceCard?: string;
  surfaceBorder?: string;
  surfaceOverlay?: string;
};

export type ThemeColorOverrideKey = keyof ThemeColorOverrides;

/** Per-token fill strength (1 = opaque). */
export type ThemeColorOpacityMap = Partial<Record<ThemeColorOverrideKey, number>>;

export type ThemeTexturePref = "default" | "none" | ThemeMotif;

export const THEME_COLOR_OVERRIDE_KEYS: readonly ThemeColorOverrideKey[] = [
  "accent",
  "surfaceBase",
  "surfaceCard",
  "surfaceBorder",
  "surfaceOverlay",
] as const;

/** Default opacity for color tokens. */
export const DEFAULT_COLOR_OPACITY = 1;
export const MIN_COLOR_OPACITY = 0.15;
export const MAX_COLOR_OPACITY = 1;

/** Catalog / CSS :root default for glass panel fill when surfaceCard opacity unset. */
export const DEFAULT_PANEL_OPACITY = 0.96;

type StoredThemeColors = ThemeColorOverrides & {
  opacity?: ThemeColorOpacityMap;
};

const COLOR_CSS_VAR: Record<ThemeColorOverrideKey, string> = {
  accent: "--accent",
  surfaceBase: "--surface-base",
  surfaceCard: "--surface-card",
  surfaceBorder: "--surface-border",
  surfaceOverlay: "--surface-overlay",
};

const PANEL_OPACITY_CSS_VAR = "--im-panel-opacity";
const PANEL_OPACITY_PCT_CSS_VAR = "--im-panel-opacity-pct";

const MOTIF_SET = new Set<string>(THEME_MOTIFS);

/** Normalize `#rgb` / `#rrggbb` to lowercase `#rrggbb`; reject others. */
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

export function clampColorOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_COLOR_OPACITY;
  return Math.min(MAX_COLOR_OPACITY, Math.max(MIN_COLOR_OPACITY, value));
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

/** CSS color for a token: opaque hex, or rgba when alpha < 1. */
export function formatCssColorWithOpacity(hex: string, opacity: number): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) return hex;
  const alpha = clampColorOpacity(opacity);
  if (alpha >= 0.999) return normalizeHexColor(hex) ?? hex;
  const rounded = Math.round(alpha * 1000) / 1000;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rounded})`;
}

function parseOpacityMap(raw: unknown): ThemeColorOpacityMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ThemeColorOpacityMap = {};
  for (const key of THEME_COLOR_OVERRIDE_KEYS) {
    const n = Number((raw as Record<string, unknown>)[key]);
    if (!Number.isFinite(n)) continue;
    const clamped = clampColorOpacity(n);
    if (Math.abs(clamped - DEFAULT_COLOR_OPACITY) < 0.001) continue;
    out[key] = clamped;
  }
  return out;
}

function parseStoredBundle(raw: string | null): {
  colors: ThemeColorOverrides;
  opacity: ThemeColorOpacityMap;
} {
  if (!raw) return { colors: {}, opacity: {} };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { colors: {}, opacity: {} };
    }
    const record = parsed as Record<string, unknown>;
    const colors: ThemeColorOverrides = {};
    for (const key of THEME_COLOR_OVERRIDE_KEYS) {
      const hex = normalizeHexColor(record[key]);
      if (hex) colors[key] = hex;
    }
    return { colors, opacity: parseOpacityMap(record.opacity) };
  } catch {
    return { colors: {}, opacity: {} };
  }
}

function writeStoredBundle(
  themeId: string,
  colors: ThemeColorOverrides,
  opacity: ThemeColorOpacityMap,
): void {
  const id = resolveThemeId(themeId);
  const key = storageThemeColorsKey(id);
  const cleaned: StoredThemeColors = {};
  for (const field of THEME_COLOR_OVERRIDE_KEYS) {
    const hex = normalizeHexColor(colors[field]);
    if (hex) cleaned[field] = hex;
  }
  const cleanedOpacity: ThemeColorOpacityMap = {};
  for (const field of THEME_COLOR_OVERRIDE_KEYS) {
    const value = opacity[field];
    if (value == null) continue;
    const clamped = clampColorOpacity(value);
    if (Math.abs(clamped - DEFAULT_COLOR_OPACITY) < 0.001) continue;
    cleanedOpacity[field] = clamped;
  }
  if (Object.keys(cleanedOpacity).length > 0) cleaned.opacity = cleanedOpacity;

  if (Object.keys(cleaned).length === 0) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(cleaned));
}

/**
 * One-shot: copy legacy panel opacity into surfaceCard opacity map for every
 * catalog theme, then set a migrated flag so apply paths skip the scan.
 */
function migrateLegacyPanelOpacityOnce(): void {
  if (localStorage.getItem(STORAGE_KEY_THEME_PANEL_OPACITY_MIGRATED) === "1") {
    return;
  }
  for (const theme of THEME_CATALOG) {
    const legacyKey = storageThemePanelOpacityKey(theme.id);
    const raw = localStorage.getItem(legacyKey);
    if (raw == null || raw === "") continue;

    const bundle = parseStoredBundle(localStorage.getItem(storageThemeColorsKey(theme.id)));
    if (bundle.opacity.surfaceCard == null) {
      const n = Number.parseFloat(raw);
      if (Number.isFinite(n)) {
        const clamped = clampColorOpacity(n);
        if (Math.abs(clamped - DEFAULT_COLOR_OPACITY) >= 0.001) {
          writeStoredBundle(theme.id, bundle.colors, {
            ...bundle.opacity,
            surfaceCard: clamped,
          });
        }
      }
    }
    localStorage.removeItem(legacyKey);
  }
  localStorage.setItem(STORAGE_KEY_THEME_PANEL_OPACITY_MIGRATED, "1");
}

/** Catalog defaults for the personalization color pickers. */
export function getCatalogColorDefaults(themeId: string): Required<ThemeColorOverrides> {
  const c = getThemeDefinition(themeId).colors;
  return {
    accent: normalizeHexColor(c.accent) ?? "#000000",
    surfaceBase: normalizeHexColor(c.surfaceBase) ?? "#000000",
    surfaceCard: normalizeHexColor(c.surfaceCard) ?? "#000000",
    surfaceBorder: normalizeHexColor(c.surfaceBorder) ?? "#000000",
    surfaceOverlay: normalizeHexColor(c.surfaceOverlay) ?? "#000000",
  };
}

export function loadThemeColorOverrides(themeId: string): ThemeColorOverrides {
  const id = resolveThemeId(themeId);
  return parseStoredBundle(localStorage.getItem(storageThemeColorsKey(id))).colors;
}

export function loadThemeColorOpacities(themeId: string): ThemeColorOpacityMap {
  const id = resolveThemeId(themeId);
  return parseStoredBundle(localStorage.getItem(storageThemeColorsKey(id))).opacity;
}

export function saveThemeColorOverrides(
  themeId: string,
  overrides: ThemeColorOverrides,
): void {
  const id = resolveThemeId(themeId);
  const { opacity } = parseStoredBundle(localStorage.getItem(storageThemeColorsKey(id)));
  writeStoredBundle(id, overrides, opacity);
}

export function saveThemeColorOpacities(
  themeId: string,
  opacity: ThemeColorOpacityMap,
): void {
  const id = resolveThemeId(themeId);
  const { colors } = parseStoredBundle(localStorage.getItem(storageThemeColorsKey(id)));
  writeStoredBundle(id, colors, opacity);
}

/** Set or clear a single color override for a theme, then persist. */
export function setThemeColorOverride(
  themeId: string,
  field: ThemeColorOverrideKey,
  value: string | null,
): ThemeColorOverrides {
  const id = resolveThemeId(themeId);
  const bundle = parseStoredBundle(localStorage.getItem(storageThemeColorsKey(id)));
  const next = { ...bundle.colors };
  const hex = value == null ? null : normalizeHexColor(value);
  if (hex) next[field] = hex;
  else delete next[field];
  writeStoredBundle(id, next, bundle.opacity);
  return next;
}

/** Set or clear a single token opacity (null / 1 clears the override). */
export function setThemeColorOpacity(
  themeId: string,
  field: ThemeColorOverrideKey,
  opacity: number | null,
): ThemeColorOpacityMap {
  const id = resolveThemeId(themeId);
  const bundle = parseStoredBundle(localStorage.getItem(storageThemeColorsKey(id)));
  const next: ThemeColorOpacityMap = { ...bundle.opacity };
  if (opacity == null || Math.abs(clampColorOpacity(opacity) - DEFAULT_COLOR_OPACITY) < 0.001) {
    delete next[field];
  } else {
    next[field] = clampColorOpacity(opacity);
  }
  writeStoredBundle(id, bundle.colors, next);
  return next;
}

export function getEffectiveColorOpacity(
  themeId: string,
  field: ThemeColorOverrideKey,
): number {
  return loadThemeColorOpacities(themeId)[field] ?? DEFAULT_COLOR_OPACITY;
}

export function getEffectiveColorOpacityMap(
  themeId: string,
): Required<ThemeColorOpacityMap> {
  const stored = loadThemeColorOpacities(themeId);
  return {
    accent: stored.accent ?? DEFAULT_COLOR_OPACITY,
    surfaceBase: stored.surfaceBase ?? DEFAULT_COLOR_OPACITY,
    surfaceCard: stored.surfaceCard ?? DEFAULT_COLOR_OPACITY,
    surfaceBorder: stored.surfaceBorder ?? DEFAULT_COLOR_OPACITY,
    surfaceOverlay: stored.surfaceOverlay ?? DEFAULT_COLOR_OPACITY,
  };
}

export function parseThemeTexturePref(raw: string | null | undefined): ThemeTexturePref {
  if (!raw || raw === "default") return "default";
  if (raw === "none") return "none";
  if (MOTIF_SET.has(raw)) return raw as ThemeMotif;
  return "default";
}

export function loadThemeTexturePref(themeId: string): ThemeTexturePref {
  const id = resolveThemeId(themeId);
  return parseThemeTexturePref(localStorage.getItem(storageThemeTextureKey(id)));
}

export function saveThemeTexturePref(themeId: string, pref: ThemeTexturePref): void {
  const id = resolveThemeId(themeId);
  const key = storageThemeTextureKey(id);
  const normalized = parseThemeTexturePref(pref);
  if (normalized === "default") {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, normalized);
}

/**
 * Effective glass/menu opacity: surfaceCard token opacity when customized,
 * else catalog / CSS default.
 */
export function getEffectivePanelOpacity(themeId: string): number {
  const id = resolveThemeId(themeId);
  const cardOpacity = loadThemeColorOpacities(id).surfaceCard;
  if (cardOpacity != null) return clampColorOpacity(cardOpacity);
  return DEFAULT_PANEL_OPACITY;
}

function clearInlineColorOverrides(root: HTMLElement): void {
  for (const field of THEME_COLOR_OVERRIDE_KEYS) {
    root.style.removeProperty(COLOR_CSS_VAR[field]);
  }
}

function applyInlineColorOverrides(
  root: HTMLElement,
  overrides: ThemeColorOverrides,
  opacity: ThemeColorOpacityMap,
  defaults: Required<ThemeColorOverrides>,
): void {
  clearInlineColorOverrides(root);
  for (const field of THEME_COLOR_OVERRIDE_KEYS) {
    const hex = overrides[field];
    const alpha = opacity[field];
    // Only write when color and/or opacity is customized.
    if (!hex && alpha == null) continue;
    const resolvedHex = hex ?? defaults[field];
    const resolvedAlpha = alpha ?? DEFAULT_COLOR_OPACITY;
    root.style.setProperty(
      COLOR_CSS_VAR[field],
      formatCssColorWithOpacity(resolvedHex, resolvedAlpha),
    );
  }
}

function resolveTextureAttr(
  themeId: string,
  pref: ThemeTexturePref,
): string {
  if (pref === "none") return "none";
  if (pref === "default") {
    return getThemeDefinition(themeId).texture ?? "none";
  }
  return pref;
}

/** Resolved texture actually applied for this theme (motif id or `none`). */
export function getEffectiveTexture(themeId: string): string {
  const id = resolveThemeId(themeId);
  return resolveTextureAttr(id, loadThemeTexturePref(id));
}

function applyPanelOpacityVars(root: HTMLElement, themeId: string): void {
  const id = resolveThemeId(themeId);
  const cardOpacity = loadThemeColorOpacities(id).surfaceCard;

  // No surfaceCard override → CSS :root default (0.96). Fully opaque card → same.
  if (
    cardOpacity == null ||
    Math.abs(cardOpacity - DEFAULT_COLOR_OPACITY) < 0.001
  ) {
    root.style.removeProperty(PANEL_OPACITY_CSS_VAR);
    root.style.removeProperty(PANEL_OPACITY_PCT_CSS_VAR);
    return;
  }

  const resolved = clampColorOpacity(cardOpacity);
  root.style.setProperty(PANEL_OPACITY_CSS_VAR, String(resolved));
  root.style.setProperty(
    PANEL_OPACITY_PCT_CSS_VAR,
    `${Math.round(resolved * 100)}%`,
  );
}

/**
 * Apply per-theme color + opacity + texture personalization onto `html`.
 * Call after catalog attrs are set (from `applyTheme`).
 * Migrates legacy panel-opacity LS once into surfaceCard opacity.
 */
export function applyThemePersonalization(themeId: string): void {
  const id = resolveThemeId(themeId);
  migrateLegacyPanelOpacityOnce();
  const root = document.documentElement;
  const colors = loadThemeColorOverrides(id);
  const opacity = loadThemeColorOpacities(id);
  const texturePref = loadThemeTexturePref(id);
  root.setAttribute("data-theme-texture", resolveTextureAttr(id, texturePref));
  applyInlineColorOverrides(root, colors, opacity, getCatalogColorDefaults(id));
  applyPanelOpacityVars(root, id);
}

/** Clear personalization storage + DOM overlays for one theme; re-apply catalog look. */
export function resetThemePersonalization(themeId: string): void {
  const id = resolveThemeId(themeId);
  localStorage.removeItem(storageThemeColorsKey(id));
  localStorage.removeItem(storageThemeTextureKey(id));
  localStorage.removeItem(storageThemePanelOpacityKey(id));
  applyThemePersonalization(id);
}

/** Effective picker values: override when set, else catalog default. */
export function getEffectiveColorPickerValues(
  themeId: string,
): Required<ThemeColorOverrides> {
  const defaults = getCatalogColorDefaults(themeId);
  const overrides = loadThemeColorOverrides(themeId);
  return {
    accent: overrides.accent ?? defaults.accent,
    surfaceBase: overrides.surfaceBase ?? defaults.surfaceBase,
    surfaceCard: overrides.surfaceCard ?? defaults.surfaceCard,
    surfaceBorder: overrides.surfaceBorder ?? defaults.surfaceBorder,
    surfaceOverlay: overrides.surfaceOverlay ?? defaults.surfaceOverlay,
  };
}
