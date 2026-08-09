import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cheap guard: production code under pages/{dashboard,timeline,items,tasks}
 * must not import another of those feature folders.
 * Tests are excluded (e.g. chrome-unity locks may compare across pages).
 *
 * Also: account/logs must import settings form surfaces from
 * ``components/settings`` — not ``pages/settings/SettingsShared``.
 */
const PAGES_DIR = resolve(__dirname, "../pages");
const FEATURES = ["dashboard", "timeline", "items", "tasks"] as const;
const SETTINGS_UI_FEATURES = ["account", "logs"] as const;

const IMPORT_RE =
  /(?:from|import\()\s*['"]([^'"]+)['"]/g;

function walkSourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkSourceFiles(full, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    if (/\.test\.(ts|tsx)$/.test(name)) continue;
    if (/(^|[._-])(testUtils|testHarness|testFixtures|testMocks)\./i.test(name)) continue;
    out.push(full);
  }
  return out;
}

function resolveCrossFeature(fromFeature: string, spec: string): string | null {
  for (const other of FEATURES) {
    if (other === fromFeature) continue;
    if (
      spec === `../${other}` ||
      spec.startsWith(`../${other}/`) ||
      spec.includes(`/pages/${other}/`) ||
      spec.endsWith(`/pages/${other}`)
    ) {
      return other;
    }
  }
  return null;
}

function importsSettingsShared(spec: string): boolean {
  return (
    spec === "../settings/SettingsShared" ||
    spec.endsWith("/settings/SettingsShared") ||
    spec.includes("/pages/settings/SettingsShared")
  );
}

describe("page feature cross-imports", () => {
  it("dashboard/timeline/items/tasks production code stays feature-local", () => {
    const violations: string[] = [];

    for (const feature of FEATURES) {
      const featureRoot = join(PAGES_DIR, feature);
      let files: string[];
      try {
        files = walkSourceFiles(featureRoot);
      } catch {
        continue;
      }

      for (const file of files) {
        const source = readFileSync(file, "utf8");
        const rel = relative(resolve(__dirname, ".."), file).replace(/\\/g, "/");
        IMPORT_RE.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = IMPORT_RE.exec(source)) !== null) {
          const other = resolveCrossFeature(feature, match[1]);
          if (other) {
            violations.push(`${rel} → ${match[1]} (${other})`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("account/logs use components/settings form kit, not SettingsShared", () => {
    const violations: string[] = [];

    for (const feature of SETTINGS_UI_FEATURES) {
      const featureRoot = join(PAGES_DIR, feature);
      let files: string[];
      try {
        files = walkSourceFiles(featureRoot);
      } catch {
        continue;
      }

      for (const file of files) {
        const source = readFileSync(file, "utf8");
        const rel = relative(resolve(__dirname, ".."), file).replace(/\\/g, "/");
        IMPORT_RE.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = IMPORT_RE.exec(source)) !== null) {
          if (importsSettingsShared(match[1])) {
            violations.push(`${rel} → ${match[1]}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
