#!/usr/bin/env node
/**
 * Run npm pyright against the uv project venv.
 *
 * Bare `pyright` falls back to PATH's `python`. On CI, `uv python install 3.11`
 * puts a clean 3.11 on PATH (no project deps), so every third-party import
 * becomes reportMissingImports. Point `--pythonpath` at `.venv` instead.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const venvPython = join(ROOT, ".venv", isWin ? "Scripts" : "bin", isWin ? "python.exe" : "python");

if (!existsSync(venvPython)) {
  console.error(`Missing uv venv interpreter: ${venvPython}`);
  console.error("Run: uv sync --extra dev --locked");
  process.exit(1);
}

const result = spawnSync("pyright", ["--pythonpath", venvPython, ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: "inherit",
  shell: isWin,
  env: process.env,
});

process.exit(result.status ?? 1);
