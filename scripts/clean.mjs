import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const generatedDirectories = [
  "web/dist",
  "desktop/dist",
  "desktop/release",
  "desktop/server-runtime",
  "dist",
  "build",
  ".hypothesis",
  ".pytest_cache",
  ".ruff_cache",
  ".mypy_cache",
  ".vitest",
  ".coverage",
  "coverage",
  "web/build-final.log",
  "node_modules/.vite",
  "node_modules/.vitest",
  "web/node_modules/.vite",
  "web/node_modules/.vitest",
  "web/coverage",
  "desktop/node_modules/.vite",
  "desktop/node_modules/.vitest",
  "desktop/coverage",
];

for (const relativePath of generatedDirectories) {
  fs.rmSync(path.join(rootDir, relativePath), { recursive: true, force: true });
}

const skippedDirectories = new Set([
  ".git",
  ".venv",
  "node_modules",
  "dist",
  "release",
  "server-runtime",
]);

const generatedCacheDirectories = new Set([
  "__pycache__",
  ".hypothesis",
  ".pytest_cache",
  ".ruff_cache",
  ".mypy_cache",
]);

function removeGeneratedPythonAndTypeScriptFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (generatedCacheDirectories.has(entry.name)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else if (!skippedDirectories.has(entry.name)) {
        removeGeneratedPythonAndTypeScriptFiles(fullPath);
      }
    } else if (
      entry.name === ".coverage" ||
      entry.name.startsWith(".coverage.") ||
      entry.name.endsWith(".tsbuildinfo") ||
      entry.name.endsWith(".pyc") ||
      entry.name.endsWith(".pyo")
    ) {
      fs.rmSync(fullPath, { force: true });
    }
  }
}

removeGeneratedPythonAndTypeScriptFiles(rootDir);
