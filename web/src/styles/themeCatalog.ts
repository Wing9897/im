/**
 * Theme catalog — single source of truth for palettes, motion, and family.
 * CSS is generated via `npm run gen:themes` → `web/src/theme.generated.css`.
 *
 * Implementation split: themeTypes / themeCatalogData (+ group modules) / themeGenerateCss.
 * This barrel keeps import paths and the gen script stable.
 */

export type {
  ThemeFamily,
  ThemeEnterStyle,
  ThemeMotif,
  ThemeTexture,
  ThemeMotion,
  ThemeColors,
  ThemeDefinition,
} from "./themeTypes.ts";
export { THEME_MOTIFS } from "./themeTypes.ts";

export {
  THEME_CATALOG,
  DEFAULT_THEME_ID,
  THEME_BY_ID,
  THEME_IDS,
  SPECIAL_THEME_IDS,
  LIGHT_THEME_IDS,
  resolveThemeId,
  getThemeDefinition,
} from "./themeCatalogData.ts";

export { generateThemeCss } from "./themeGenerateCss.ts";
