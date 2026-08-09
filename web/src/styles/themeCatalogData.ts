/** Theme catalog entries and lookup helpers. */

import type { ThemeDefinition } from "./themeTypes.ts";
export type { ThemeDefinition } from "./themeTypes.ts";

export { DESK_MOTION, CLASSIC_MOTION } from "./themeCatalogShared.ts";
import { THEME_CATALOG_DESK } from "./themeCatalogDesk.ts";
import { THEME_CATALOG_CLASSIC } from "./themeCatalogClassic.ts";
import { THEME_CATALOG_SPECIAL } from "./themeCatalogSpecial.ts";

const THEME_GROUPS: readonly ThemeDefinition[] = [
  ...THEME_CATALOG_DESK,
  ...THEME_CATALOG_CLASSIC,
  ...THEME_CATALOG_SPECIAL,
];

/** Stable picker / swatch listing order (matches pre-split catalog). */
const THEME_ORDER = [
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
  "sakura"
] as const;

/**
 * Mixed-hue catalogs: near-black / paper bases with non-matching accents.
 * Swatches: [base, card, accent, secondaryHue, text].
 */
export const THEME_CATALOG: readonly ThemeDefinition[] = THEME_ORDER.map((id) => {
  const theme = THEME_GROUPS.find((t) => t.id === id);
  if (!theme) throw new Error(`Missing theme catalog entry: ${id}`);
  return theme;
});

export const DEFAULT_THEME_ID = "command-center";

export const THEME_BY_ID: ReadonlyMap<string, ThemeDefinition> = new Map(
  THEME_CATALOG.map((t) => [t.id, t]),
);

export const THEME_IDS = new Set(THEME_CATALOG.map((t) => t.id));

export const SPECIAL_THEME_IDS = new Set(
  THEME_CATALOG.filter((t) => t.special).map((t) => t.id),
);

export const LIGHT_THEME_IDS = new Set(
  THEME_CATALOG.filter((t) => t.light).map((t) => t.id),
);

/** Validate against the catalog; unknown / empty → default. */
export function resolveThemeId(themeId: string | null | undefined): string {
  if (!themeId) return DEFAULT_THEME_ID;
  return THEME_IDS.has(themeId) ? themeId : DEFAULT_THEME_ID;
}

export function getThemeDefinition(themeId: string): ThemeDefinition {
  const id = resolveThemeId(themeId);
  return THEME_BY_ID.get(id)!;
}
