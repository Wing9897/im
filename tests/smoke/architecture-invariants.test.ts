import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Smoke tests for live architecture invariants:
 * - hooks/components/board must not import pages/
 * - Generated artifacts gitignored and untracked
 * - No deep i18n/i18n imports (use barrel)
 * - Migrated layout paths (no viewer/, no root src/)
 */

const ROOT_DIR = path.resolve(__dirname, "../..");
const SRC_DIR = path.resolve(ROOT_DIR, "web", "src");

/** Recursively collect files matching given extensions from a directory. */
function collectFiles(
  dir: string,
  extensions: string[],
  excludePatterns: string[] = [],
): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
      results.push(...collectFiles(fullPath, extensions, excludePatterns));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      const shouldExclude = excludePatterns.some((pattern) =>
        entry.name.endsWith(pattern),
      );
      if (!shouldExclude) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

describe("Dead code removal: standalone viewer project removed", () => {
  it("viewer/ standalone directory does not exist", () => {
    const viewerDir = path.resolve(ROOT_DIR, "viewer");
    expect(fs.existsSync(viewerDir)).toBe(false);
  });
});

// --- Legacy reference scans (product code roots) ---

const PRODUCT_CODE_ROOTS: Array<{ dir: string; extensions: string[] }> = [
  { dir: path.resolve(ROOT_DIR, "server"), extensions: [".py"] },
  { dir: path.resolve(ROOT_DIR, "web", "src"), extensions: [".ts", ".tsx"] },
  { dir: path.resolve(ROOT_DIR, "desktop"), extensions: [".ts"] },
];

const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|py)$/;
const PY_TEST_PATTERN = /(^test_|_test)\.py$/;
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "__pycache__", "tests", ".venv", "venv"]);

function collectProductFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      results.push(...collectProductFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      const base = path.basename(entry.name);
      if (TEST_FILE_PATTERN.test(base)) continue;
      if (PY_TEST_PATTERN.test(base)) continue;
      results.push(fullPath);
    }
  }
  return results;
}

function allProductFiles(): string[] {
  return PRODUCT_CODE_ROOTS.flatMap((r) => collectProductFiles(r.dir, r.extensions));
}

function relFromRoot(file: string): string {
  return path.relative(ROOT_DIR, file).replace(/\\/g, "/");
}

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT_DIR, encoding: "utf-8" }).trim();
}

describe("Dead references: migrated legacy directories removed", () => {
  it("old root src/ directory does not exist (migrated to web/src)", () => {
    expect(fs.existsSync(path.resolve(ROOT_DIR, "src"))).toBe(false);
    expect(fs.existsSync(path.resolve(ROOT_DIR, "web", "src"))).toBe(true);
  });
});

describe("Dead references: no old root src/ path references in product code", () => {
  it("no product file imports or resolves a path to the old root src/ directory", () => {
    const deadRootSrcPattern =
      /(?:from\s+['"]|import\s*\(\s*['"]|require\s*\(\s*['"])(?:\.\.\/)*src\//;
    const offenders: string[] = [];
    for (const file of allProductFiles()) {
      const content = fs.readFileSync(file, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        if (deadRootSrcPattern.test(line)) {
          offenders.push(`${relFromRoot(file)} :: ${line.trim()}`);
        }
      }
    }

    if (offenders.length > 0) {
      const report = offenders.map((f) => `  - ${f}`).join("\n");
      expect(offenders, `Found product files referencing old root src/:\n${report}`).toEqual([]);
    }
  });
});

/** web/src + desktop product code only (excludes tests, OpenAPI/schema.d.ts). */
const WEB_DESKTOP_PRODUCT_ROOTS: Array<{ dir: string; extensions: string[] }> = [
  { dir: path.resolve(ROOT_DIR, "web", "src"), extensions: [".ts", ".tsx"] },
  { dir: path.resolve(ROOT_DIR, "desktop"), extensions: [".ts"] },
];

const SKIP_GENERATED_API_ARTIFACT = /(?:openapi\.json|schema\.d\.ts)$/;

function collectWebDesktopProductFiles(): string[] {
  return WEB_DESKTOP_PRODUCT_ROOTS.flatMap((r) => collectProductFiles(r.dir, r.extensions)).filter(
    (file) => !SKIP_GENERATED_API_ARTIFACT.test(path.basename(file)),
  );
}

function scanWebDesktopForPatterns(
  patterns: RegExp[],
  label: string,
): void {
  const offenders: string[] = [];
  for (const file of collectWebDesktopProductFiles()) {
    const content = fs.readFileSync(file, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
        continue;
      }
      if (patterns.some((p) => p.test(line))) {
        offenders.push(`${relFromRoot(file)} :: ${trimmed}`);
        break;
      }
    }
  }

  if (offenders.length > 0) {
    const report = offenders.map((f) => `  - ${f}`).join("\n");
    expect(offenders, `${label}:\n${report}`).toEqual([]);
  }
}

describe("Retired auth: no legacy config/api-key paths in web/desktop product code", () => {
  it("no references to config/api-key or /api/v1/config/api-key", () => {
    scanWebDesktopForPatterns(
      [/config\/api-key/, /\/api\/v1\/config\/api-key/],
      "Retired config/api-key paths must not reappear in product code",
    );
  });
});

describe("Retired auth: no login-with-api-key or pairing-code setup paths in web/desktop product code", () => {
  it("no references to /setup/login-with-api-key or /setup/pairing-code", () => {
    scanWebDesktopForPatterns(
      [/\/setup\/login-with-api-key/, /\/setup\/pairing-code/],
      "Retired setup login-with-api-key / pairing-code paths must not reappear in product code",
    );
  });
});

describe("Retired auth: no deviceAccessToken module in web/desktop product code", () => {
  it("no deviceAccessToken identifier or domain/access/deviceAccessToken import path", () => {
    // The retired module and every export it had were singular-prefixed
    // (deviceAccessToken, deviceAccessTokenConfiguredHint). The plural
    // `deviceAccessTokens` names the server-side device_access_tokens table
    // in retention copy and is not part of the retired client-side module.
    scanWebDesktopForPatterns(
      [/\bdeviceAccessToken(?!s)/, /domain\/access\/deviceAccessToken/],
      "Retired deviceAccessToken paths must not reappear in product code",
    );
  });
});

describe("Frontend layering: domain must not import components/ or pages/", () => {
  const domainImportPattern =
    /(?:from\s+['"]|import\s*\(\s*['"])(?:\.\.\/)*(?:components|pages)\//;

  it("no production file under domain/ imports components/ or pages/", () => {
    const domainDir = path.join(SRC_DIR, "domain");
    const offenders: string[] = [];
    if (!fs.existsSync(domainDir)) {
      return;
    }
    const files = collectFiles(domainDir, [".ts", ".tsx"], [".test.ts", ".test.tsx"]);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
          continue;
        }
        if (domainImportPattern.test(line)) {
          offenders.push(`${relFromRoot(file)} :: ${trimmed}`);
        }
      }
    }
    if (offenders.length > 0) {
      const report = offenders.map((f) => `  - ${f}`).join("\n");
      expect(
        offenders,
        `domain/ must not import components/ or pages/:\n${report}`,
      ).toEqual([]);
    }
  });
});

describe("Schema narratives track CURRENT_SCHEMA_VERSION", () => {
  /** Single source of truth: CURRENT_SCHEMA_VERSION in server/db/schema_inspect.py. */
  function readCurrentSchemaVersion(): number {
    const inspectPath = path.resolve(ROOT_DIR, "server", "db", "schema_inspect.py");
    const source = fs.readFileSync(inspectPath, "utf-8");
    const match = source.match(/^CURRENT_SCHEMA_VERSION\s*=\s*(\d+)\s*$/m);
    expect(match, `CURRENT_SCHEMA_VERSION not found in ${relFromRoot(inspectPath)}`).toBeTruthy();
    return Number(match![1]);
  }

  function readSchemaSemver(): string {
    const inspectPath = path.resolve(ROOT_DIR, "server", "db", "schema_inspect.py");
    const source = fs.readFileSync(inspectPath, "utf-8");
    const match = source.match(/^SCHEMA_SEMVER\s*=\s*"([^"]+)"\s*$/m);
    expect(match, `SCHEMA_SEMVER not found in ${relFromRoot(inspectPath)}`).toBeTruthy();
    return match![1];
  }

  /** Wipe-floor hard-reject ceiling = min(registered MigrationStep sources) - 1, else current - 1. */
  function readHardRejectCeiling(current: number): number {
    const migrationsPath = path.resolve(ROOT_DIR, "server", "db", "migrations.py");
    const source = fs.readFileSync(migrationsPath, "utf-8");
    const sources = [...source.matchAll(/MigrationStep\(\s*(\d+)\s*,\s*(\d+)/g)].map((m) =>
      Number(m[1]),
    );
    if (sources.length === 0) return current - 1;
    return Math.min(...sources) - 1;
  }

  it("ARCHITECTURE.md states the current baseline (not an older one)", () => {
    const current = readCurrentSchemaVersion();
    const archPath = path.resolve(ROOT_DIR, "docs", "ARCHITECTURE.md");
    expect(fs.existsSync(archPath)).toBe(true);
    const content = fs.readFileSync(archPath, "utf-8");
    for (let older = 1; older < current; older += 1) {
      expect(
        content,
        `ARCHITECTURE.md must not advertise v${older} as the current baseline`,
      ).not.toMatch(new RegExp(String.raw`current baseline\s+\*?\*?v${older}\b`, "i"));
    }
    expect(content).toMatch(
      new RegExp(
        String.raw`baseline\s+\*\*v${current}\*\*|baseline\s+v${current}\b|CURRENT.*v${current}|schema v${current}\b|stamp\s+\*\*?v?${current}\*\*?`,
        "i",
      ),
    );
  });

  it("README.md states the current wipe-only baseline and hard-reject policy", () => {
    const current = readCurrentSchemaVersion();
    const hardRejectCeiling = readHardRejectCeiling(current);
    const readmePath = path.resolve(ROOT_DIR, "README.md");
    const content = fs.readFileSync(readmePath, "utf-8");

    expect(content).toMatch(new RegExp(String.raw`\*\*schema v${current}\*\*`, "i"));
    if (hardRejectCeiling >= 1) {
      expect(content).toMatch(
        new RegExp(String.raw`v1[–-]v${hardRejectCeiling}[^\r\n]*hard-reject`, "i"),
      );
    } else {
      // Empty registry at stamp 1: legacy / non-current stamps hard-reject (must reset).
      expect(content).toMatch(/hard-reject/i);
      expect(content).toMatch(/reset/i);
    }
  });

  it("desktop schema hint states the current wipe-only baseline", () => {
    const current = readCurrentSchemaVersion();
    const semver = readSchemaSemver();
    const hardRejectCeiling = readHardRejectCeiling(current);
    const hintPath = path.resolve(ROOT_DIR, "desktop", "shell-i18n.ts");
    const content = fs.readFileSync(hintPath, "utf-8");

    expect(content).toMatch(
      new RegExp(String.raw`schema baseline ${current}|current is v${current}\b`, "i"),
    );
    expect(content).toContain(semver);
    if (hardRejectCeiling >= 1) {
      expect(content).toMatch(
        new RegExp(String.raw`v1[–-]v${hardRejectCeiling}[^\r\n]*hard-rejected`, "i"),
      );
    } else {
      expect(content).toMatch(/must be reset|舊庫須重置|旧库须重置/i);
    }
  });
});

describe("Frontend cleanup: empty constants/ directory must not exist", () => {
  it("web/src/constants/ is absent", () => {
    expect(fs.existsSync(path.join(SRC_DIR, "constants"))).toBe(false);
  });
});

describe("Persistence keys: production im: literals live in key modules", () => {
  const imLiteral =
    /(?:["'`]im:[^"'`]+["'`]|`im:[^`]*\$\{)/;

  function isAllowedImKeyModule(relFromSrc: string): boolean {
    if (relFromSrc.startsWith("domain/")) return true;
    if (/PersistedKeys\.ts$/.test(relFromSrc)) return true;
    if (/Keys\.ts$/.test(relFromSrc)) return true;
    return false;
  }

  it("im: string/template literals only appear in *PersistedKeys* / *Keys / domain", () => {
    const files = collectFiles(SRC_DIR, [".ts", ".tsx"], [".test.ts", ".test.tsx"]);
    const offenders: string[] = [];
    for (const file of files) {
      const rel = path.relative(SRC_DIR, file).replace(/\\/g, "/");
      if (isAllowedImKeyModule(rel)) continue;
      const content = fs.readFileSync(file, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
          continue;
        }
        if (imLiteral.test(line)) {
          offenders.push(`${rel} :: ${trimmed}`);
          break;
        }
      }
    }
    if (offenders.length > 0) {
      const report = offenders.map((f) => `  - ${f}`).join("\n");
      expect(
        offenders,
        `production im: keys must live in *PersistedKeys* / *Keys / domain modules:\n${report}`,
      ).toEqual([]);
    }
  });
});

describe("Frontend layering: hooks/components/board must not import pages/", () => {
  /**
   * Allowed dependency direction: pages → domain/components/hooks/api;
   * hooks → domain/api; components/board → domain. hooks/, components/, and
   * board/ must never reach into pages/ (shared logic belongs in domain/).
   */
  const LAYER_ROOTS = ["hooks", "components", "board"] as const;
  const pagesImportPattern =
    /(?:from\s+['"]|import\s*\(\s*['"])(?:\.\.\/)*pages\//;

  it("no production file under hooks/, components/, or board/ imports pages/", () => {
    const offenders: string[] = [];

    for (const layer of LAYER_ROOTS) {
      const layerDir = path.join(SRC_DIR, layer);
      if (!fs.existsSync(layerDir)) continue;

      // Test files may import pages/ for page-level UI assertions; production code may not.
      const files = collectFiles(layerDir, [".ts", ".tsx"], [".test.ts", ".test.tsx"]);
      for (const file of files) {
        const content = fs.readFileSync(file, "utf-8");
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
          if (pagesImportPattern.test(line)) {
            offenders.push(`${relFromRoot(file)} :: ${trimmed}`);
          }
        }
      }
    }

    if (offenders.length > 0) {
      const report = offenders.map((f) => `  - ${f}`).join("\n");
      expect(
        offenders,
        `hooks/, components/, and board/ must not import pages/ (move shared logic to domain/):\n${report}`,
      ).toEqual([]);
    }
  });
});

describe("i18n: no deep i18n/i18n imports (use barrel)", () => {
  const deepI18nImportPattern =
    /(?:from\s+|import\s*\(\s*)['"][^'"]*i18n\/i18n(?:\.ts|\.tsx|\.js)?['"]/;

  it("no web/src file outside i18n/ deep-imports i18n/i18n", () => {
    const files = collectFiles(SRC_DIR, [".ts", ".tsx"]);
    const offenders: string[] = [];

    for (const file of files) {
      const rel = path.relative(SRC_DIR, file).replace(/\\/g, "/");
      if (rel === "i18n/i18n.ts" || rel.startsWith("i18n/")) continue;

      const content = fs.readFileSync(file, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
          continue;
        }
        if (deepI18nImportPattern.test(line)) {
          offenders.push(rel);
          break;
        }
      }
    }

    if (offenders.length > 0) {
      const report = offenders.map((f) => `  - ${f}`).join("\n");
      expect(
        offenders,
        `Deep imports of i18n/i18n (use the i18n barrel instead):\n${report}`,
      ).toEqual([]);
    }
  });
});

describe("Generated artifacts are gitignored and untracked", () => {
  const gitignore = fs.readFileSync(path.resolve(ROOT_DIR, ".gitignore"), "utf-8");
  const gitignoreLines = gitignore.split(/\r?\n/).map((l) => l.trim());

  it(".gitignore contains defensive generated-artifact entries", () => {
    for (const pattern of [
      "**/.vite/",
      ".vitest/",
      "**/coverage/",
      "*.egg-info/",
      "*.tsbuildinfo",
    ]) {
      expect(gitignoreLines).toContain(pattern);
    }
  });

  it("no generated build output or cache is tracked by git", () => {
    const generatedArtifactPattern =
      /(^|\/)(web\/dist|desktop\/dist|desktop\/release|desktop\/server-runtime|build|\.vite|\.vitest|coverage|__pycache__|\.pytest_cache|\.ruff_cache|\.mypy_cache|\.hypothesis)(\/|$)|(^|\/)\.coverage(?:\..*)?$|\.egg-info\/|\.py[co]$|\.tsbuildinfo$/;
    const tracked = git(["ls-files"])
      .split(/\r?\n/)
      .filter((f) => f.length > 0)
      .filter((f) => generatedArtifactPattern.test(f));

    if (tracked.length > 0) {
      const report = tracked.map((f) => `  - ${f}`).join("\n");
      expect(tracked, `Found tracked generated artifacts that must be untracked:\n${report}`).toEqual([]);
    }
  });

  it("git check-ignore confirms representative generated artifacts are ignored", () => {
    const probes = [
      "intelligence_monitor_server.egg-info/",
      "web/dist/index.html",
      "desktop/dist/main.js",
      "desktop/release/IntelligenceMonitor.exe",
      "desktop/server-runtime/python.exe",
      "build/server/intelligence-monitor.exe",
      "node_modules/.vite/vitest/results.json",
      ".vitest/results.json",
      "web/coverage/index.html",
      "server/__pycache__/module.pyc",
      "web/tsconfig.app.tsbuildinfo",
    ];
    let ignored: string[] = [];
    try {
      ignored = git(["check-ignore", ...probes]).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    } catch {
      ignored = [];
    }
    for (const probe of probes) {
      expect(ignored, `${probe} should be git-ignored`).toContain(probe);
    }
  });
});
