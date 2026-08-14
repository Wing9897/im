import {
  storageThemeColorsKey,
  storageThemeTextureKey,
} from "../domain/prefs";
import { resolveThemeId } from "./themeCatalog";
import {
  DEFAULT_COLOR_OPACITY,
  THEME_COLOR_OVERRIDE_KEYS,
  clampColorOpacity,
  formatCssColorWithOpacity,
  getCatalogColorDefaults,
  loadThemeColorOpacities,
  loadThemeColorOverrides,
  normalizeHexColor,
  type ThemeColorOpacityMap,
  type ThemeColorOverrideKey,
  type ThemeColorOverrides,
} from "./themePersonalizationColor";
import {
  loadThemeTexturePref,
  resolveTextureAttr,
} from "./themePersonalizationTexture";

/** Photo BG floor for personalized ``--surface-panel`` (matches theme.css 63%). */
export const PHOTO_SURFACE_PANEL_FLOOR = 0.63;

const COLOR_CSS_VAR: Record<ThemeColorOverrideKey, string> = {
  accent: "--accent",
  surfaceBase: "--surface-base",
  surfaceCard: "--surface-card",
  surfaceBorder: "--surface-border",
  surfaceOverlay: "--surface-overlay",
};

const SURFACE_PANEL_CSS_VAR = "--surface-panel";

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
    // Panel fill strength is SoT on --surface-panel (see applyPanelOpacityVars).
    // Keep --surface-card as solid hex so color-mix(panel) is not double-softened.
    if (field === "surfaceCard") {
      root.style.setProperty(
        COLOR_CSS_VAR[field],
        normalizeHexColor(resolvedHex) ?? resolvedHex,
      );
      continue;
    }
    const resolvedAlpha = alpha ?? DEFAULT_COLOR_OPACITY;
    root.style.setProperty(
      COLOR_CSS_VAR[field],
      formatCssColorWithOpacity(resolvedHex, resolvedAlpha),
    );
  }
}

function applyPanelOpacityVars(root: HTMLElement, themeId: string): void {
  const id = resolveThemeId(themeId);
  const cardOpacity = loadThemeColorOpacities(id).surfaceCard;

  // No surfaceCard override → unlayered theme.css --surface-panel. Fully opaque → same.
  if (
    cardOpacity == null ||
    Math.abs(cardOpacity - DEFAULT_COLOR_OPACITY) < 0.001
  ) {
    root.style.removeProperty(SURFACE_PANEL_CSS_VAR);
    return;
  }

  let strength = clampColorOpacity(cardOpacity);
  // Photo BG: do not let personalization thin panels below the system readable floor.
  const bgMode = root.getAttribute("data-theme-bg");
  if (
    (bgMode === "custom" || bgMode === "focal") &&
    strength < PHOTO_SURFACE_PANEL_FLOOR
  ) {
    strength = PHOTO_SURFACE_PANEL_FLOOR;
  }
  const pct = Math.round(strength * 100);
  // Single SoT for panel strength (--surface-panel only).
  root.style.setProperty(
    SURFACE_PANEL_CSS_VAR,
    `color-mix(in srgb, var(--surface-card) ${pct}%, transparent)`,
  );
}

/**
 * Apply per-theme color + opacity + texture personalization onto `html`.
 * Call after catalog attrs are set (from `applyTheme`).
 */
export function applyThemePersonalization(themeId: string): void {
  const id = resolveThemeId(themeId);
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
  applyThemePersonalization(id);
}
