import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Smoke tests validating the consolidated test directory layout.
 *
 * The repository keeps four clearly separated test homes:
 *   1. Backend Python tests live ONLY under `server/tests/` (run by
 *      `pytest server/tests`). No `test_*.py` / `*_test.py` files may sit
 *      outside `server/tests/` — in particular the root `tests/` dir must
 *      hold zero Python test files.
 *   2. Web component/unit/property tests live under `web/src/**` and run by
 *      the `web/` vitest config.
 *   3. Desktop shell tests live under `desktop/tests/` and run by the
 *      `desktop/` vitest config.
 *   4. Retained cross-repo audit/smoke/integration tests stay at the root
 *      `tests/` dir, and the root `vitest.config.ts` `include` range must match
 *      the test files that actually exist there.
 */

const ROOT_DIR = path.resolve(__dirname, "../..");
const SERVER_TESTS_DIR = path.resolve(ROOT_DIR, "server", "tests");
const WEB_SRC_DIR = path.resolve(ROOT_DIR, "web", "src");
const DESKTOP_TESTS_DIR = path.resolve(ROOT_DIR, "desktop", "tests");
const ROOT_TESTS_DIR = path.resolve(ROOT_DIR, "tests");

// Directories that are never part of the project's own test layout.
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".kiro",
  ".hypothesis",
  ".venv",
  "venv",
  "dist",
  "build",
  "coverage",
  "__pycache__",
  ".pytest_cache",
  ".ruff_cache",
  ".mypy_cache",
  "__test_tmp_scanners__",
  "target",
  // Packaged / PyInstaller outputs (may vendor third-party test trees).
  "server-runtime",
  "release",
  "archive",
]);

/** Recursively collect files under `dir` whose relative path satisfies `match`. */
function collectFiles(
  dir: string,
  match: (relativePath: string, fileName: string) => boolean,
): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  function walk(current: string): void {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full);
      } else {
        const rel = path.relative(ROOT_DIR, full).replace(/\\/g, "/");
        if (match(rel, entry.name)) results.push(rel);
      }
    }
  }

  walk(dir);
  return results;
}

/** True when the file name looks like a Python test (pytest discovery rules). */
function isPythonTestFile(fileName: string): boolean {
  return /^test_.*\.py$/.test(fileName) || /.*_test\.py$/.test(fileName);
}

/** True when the file name looks like a frontend (JS/TS) test file. */
function isFrontendTestFile(fileName: string): boolean {
  return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(fileName) ||
    /\.(prop|property)\.test\.(ts|tsx|js|jsx)$/.test(fileName);
}

/** Convert a vitest glob (e.g. `tests/ ** /*.test.ts`) into an anchored RegExp. */
function globToRegExp(glob: string): RegExp {
  const g = glob.replace(/\\/g, "/");
  let re = "";
  let i = 0;
  while (i < g.length) {
    const c = g[i];
    if (c === "*") {
      if (g[i + 1] === "*") {
        if (g[i + 2] === "/") {
          re += "(?:.*/)?"; // ** / matches any number of path segments
          i += 3;
        } else {
          re += ".*";
          i += 2;
        }
      } else {
        re += "[^/]*"; // * matches within a single path segment
        i += 1;
      }
    } else if (".+?^${}()|[]\\".includes(c)) {
      re += "\\" + c;
      i += 1;
    } else {
      re += c;
      i += 1;
    }
  }
  return new RegExp("^" + re + "$");
}

/** Parse the `include` string-literal array from the root vitest config. */
function parseRootVitestInclude(): string[] {
  const configPath = path.resolve(ROOT_DIR, "vitest.config.ts");
  const content = fs.readFileSync(configPath, "utf-8");
  const includeMatch = content.match(/include\s*:\s*\[([\s\S]*?)\]/);
  expect(includeMatch, "root vitest.config.ts must declare an include array").toBeTruthy();
  const body = includeMatch![1];
  const globs: string[] = [];
  const re = /["'`]([^"'`]+)["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    globs.push(m[1]);
  }
  return globs;
}

describe("Test layout: backend Python tests live only under server/tests/", () => {
  it("no test_*.py / *_test.py files exist outside server/tests/", () => {
    const pyTests = collectFiles(ROOT_DIR, (_rel, name) => isPythonTestFile(name));
    const misplaced = pyTests.filter((rel) => {
      const abs = path.resolve(ROOT_DIR, rel);
      const relToServerTests = path.relative(SERVER_TESTS_DIR, abs);
      // Inside server/tests/ when the relative path does not climb out (`..`).
      return relToServerTests.startsWith("..") || path.isAbsolute(relToServerTests);
    });

    expect(
      misplaced,
      `Python test files found outside server/tests/:\n${misplaced.map((f) => `  - ${f}`).join("\n")}`,
    ).toEqual([]);
  });

  it("root tests/ directory contains zero Python test files", () => {
    const rootPyTests = collectFiles(ROOT_TESTS_DIR, (_rel, name) => isPythonTestFile(name));
    expect(
      rootPyTests,
      `root tests/ should hold no Python test files:\n${rootPyTests.map((f) => `  - ${f}`).join("\n")}`,
    ).toEqual([]);
  });

  it("server/tests/ actually contains backend Python tests (sanity)", () => {
    const serverPyTests = collectFiles(SERVER_TESTS_DIR, (_rel, name) => isPythonTestFile(name));
    expect(serverPyTests.length).toBeGreaterThan(0);
  });
});

describe("Test layout: JavaScript/TypeScript tests use web, desktop, or root homes", () => {
  it("every JS/TS test file belongs to one of the three configured homes", () => {
    const frontendTests = collectFiles(ROOT_DIR, (_rel, name) => isFrontendTestFile(name));

    const stray = frontendTests.filter((rel) => {
      const underWebSrc = rel.startsWith("web/src/");
      const underDesktopTests = rel.startsWith("desktop/tests/");
      const underRootTests = rel.startsWith("tests/");
      return !underWebSrc && !underDesktopTests && !underRootTests;
    });

    expect(
      stray,
      `JS/TS test files must live under web/src/**, desktop/tests/, or root tests/:\n${stray.map((f) => `  - ${f}`).join("\n")}`,
    ).toEqual([]);
  });

  it("web/src/** actually contains web tests (sanity)", () => {
    const webTests = collectFiles(WEB_SRC_DIR, (_rel, name) => isFrontendTestFile(name));
    expect(webTests.length).toBeGreaterThan(0);
  });

  it("desktop/tests/ actually contains desktop tests (sanity)", () => {
    const desktopTests = collectFiles(DESKTOP_TESTS_DIR, (_rel, name) => isFrontendTestFile(name));
    expect(desktopTests.length).toBeGreaterThan(0);
  });
});

describe("Test layout: root vitest include matches retained cross-repo tests", () => {
  const includeGlobs = parseRootVitestInclude();
  const includeRegexes = includeGlobs.map(globToRegExp);

  it("all include globs are scoped to the root tests/ directory", () => {
    const outOfScope = includeGlobs.filter((g) => !g.replace(/\\/g, "/").startsWith("tests/"));
    expect(
      outOfScope,
      `root vitest include globs must target the tests/ dir:\n${outOfScope.map((g) => `  - ${g}`).join("\n")}`,
    ).toEqual([]);
  });

  it("every retained test file under tests/ is matched by an include glob", () => {
    const rootTestFiles = collectFiles(ROOT_TESTS_DIR, (_rel, name) => isFrontendTestFile(name));
    expect(rootTestFiles.length, "expected retained cross-repo tests under tests/").toBeGreaterThan(0);

    const unmatched = rootTestFiles.filter(
      (rel) => !includeRegexes.some((re) => re.test(rel)),
    );

    expect(
      unmatched,
      `Retained tests/ files not covered by root vitest include:\n${unmatched.map((f) => `  - ${f}`).join("\n")}`,
    ).toEqual([]);
  });

  it("every include glob matches at least one existing file (no dead patterns)", () => {
    const rootTestFiles = collectFiles(ROOT_TESTS_DIR, (_rel, name) => isFrontendTestFile(name));
    const deadGlobs = includeGlobs.filter((g) => {
      const re = globToRegExp(g);
      return !rootTestFiles.some((rel) => re.test(rel));
    });

    expect(
      deadGlobs,
      `root vitest include globs that match no existing file:\n${deadGlobs.map((g) => `  - ${g}`).join("\n")}`,
    ).toEqual([]);
  });
});
