/**
 * Generate web/src/theme.generated.css from themeCatalog.ts.
 * Usage: tsx scripts/generate-theme-css.mjs  (or: npm run gen:themes)
 * Runs via tsx so Node 20.19+ can import the TypeScript catalog.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "web", "src", "styles", "themeCatalog.ts");
const outPath = path.join(root, "web", "src", "theme.generated.css");

const { generateThemeCss, THEME_CATALOG } = await import(
  pathToFileURL(catalogPath).href
);

if (!Array.isArray(THEME_CATALOG) || THEME_CATALOG.length === 0) {
  console.error("[gen:themes] THEME_CATALOG is empty");
  process.exit(1);
}

const css = generateThemeCss();
writeFileSync(outPath, css, "utf8");
console.log(
  `[gen:themes] Wrote ${path.relative(root, outPath)} (${THEME_CATALOG.length} themes, ${css.length} bytes)`,
);
