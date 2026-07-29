/** localStorage keys for theme id / background overrides. */

export const STORAGE_KEY_THEME = "im:theme";

export function storageBgKey(themeId: string): string {
  return `im:theme-bg:${themeId}`;
}

export function storageBgOpacityKey(themeId: string): string {
  return `im:theme-bg-opacity:${themeId}`;
}

/** Per-theme color CSS-variable overrides (JSON object). */
export function storageThemeColorsKey(themeId: string): string {
  return `im:theme-colors:${themeId}`;
}

/** Per-theme texture preference: default | none | motif id. */
export function storageThemeTextureKey(themeId: string): string {
  return `im:theme-texture:${themeId}`;
}

/**
 * Legacy per-theme panel opacity (pre per-color opacity).
 * Kept only for one-shot migrate → `surfaceCard` opacity; do not write.
 */
export function storageThemePanelOpacityKey(themeId: string): string {
  return `im:theme-panel-opacity:${themeId}`;
}

/** Set after one-shot panel-opacity migrate across catalog themes. */
export const STORAGE_KEY_THEME_PANEL_OPACITY_MIGRATED =
  "im:theme-panel-opacity-migrated";

