import { storageThemeTextureKey } from "../domain/prefs";
import {
  THEME_MOTIFS,
  getThemeDefinition,
  resolveThemeId,
  type ThemeMotif,
} from "./themeCatalog";

export type ThemeTexturePref = "default" | "none" | ThemeMotif;

const MOTIF_SET = new Set<string>(THEME_MOTIFS);

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

/** Texture attribute for a theme + pref (`default` falls back to catalog). */
export function resolveTextureAttr(
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
