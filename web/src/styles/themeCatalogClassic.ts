/** Classic-family theme catalog entries (paper + ink blocks). */

import type { ThemeDefinition } from "./themeTypes.ts";
import { THEME_CATALOG_CLASSIC_INK } from "./themeCatalogClassicInk.ts";
import { THEME_CATALOG_CLASSIC_PAPER } from "./themeCatalogClassicPaper.ts";

export const THEME_CATALOG_CLASSIC: readonly ThemeDefinition[] = [
  ...THEME_CATALOG_CLASSIC_PAPER,
  ...THEME_CATALOG_CLASSIC_INK,
];
