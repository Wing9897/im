/**
 * Build web/dist via Vite using Node directly (avoids broken System32\npm on Windows).
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const webDir = path.join(projectRoot, "web");

const require = createRequire(path.join(webDir, "package.json"));
const vitePackageJson = require.resolve("vite/package.json");
const viteBin = path.join(path.dirname(vitePackageJson), "bin", "vite.js");

console.log("[build:web] Generating theme CSS...");
const genThemes = spawnSync(
  process.execPath,
  ["--experimental-strip-types", path.join(projectRoot, "scripts", "generate-theme-css.mjs")],
  { cwd: projectRoot, stdio: "inherit" },
);
if (genThemes.status !== 0) {
  process.exit(genThemes.status ?? 1);
}

console.log("[build:web] Running Vite build...");
const result = spawnSync(process.execPath, [viteBin, "build"], {
  cwd: webDir,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("[build:web] Done → web/dist");
