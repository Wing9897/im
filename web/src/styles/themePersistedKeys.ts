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

