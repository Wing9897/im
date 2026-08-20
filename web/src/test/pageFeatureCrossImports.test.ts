import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cheap guard: production code under a `pages/<feature>` directory must not
 * import another feature's directory. Every directory under `pages/` counts as
 * a feature except `shared`, which is the deliberate cross-feature chrome
 * (workspace shell, route helpers, empty-state presets).
 * Tests are excluded (e.g. chrome-unity locks may compare across pages).
 *
 * Also: no feature may reach into `pages/settings/SettingsShared` — the settings
 * form kit lives in `components/settings` and the outlet accessor in
 * `components/settings/useSettingsPageState`.
 */
const PAGES_DIR = resolve(__dirname, "../pages");
/** Deliberate cross-feature chrome; not a feature of its own. */
const SHARED_DIRS = new Set(["shared"]);

function featureDirs(): string[] {
  return readdirSync(PAGES_DIR)
    .filter((name) => statSync(join(PAGES_DIR, name)).isDirectory())
    .filter((name) => !SHARED_DIRS.has(name));
}

const FEATURES = featureDirs();

/** Existing dashboard ↔ workset chrome; lock still fails on any new edge. */
const ALLOWED_CROSS_FEATURE = new Set([
  "pages/dashboard/components/DashboardViewerToolbar.tsx → ../../worksets/WorksetCatalogChrome (worksets)",
  "pages/dashboard/DashboardViewer.tsx → ../worksets/WorksetPipelineGraphPanel (worksets)",
  "pages/worksets/WorksetContentsPanel.tsx → ../dashboard/hooks/useWorksetDetailData (dashboard)",
  "pages/worksets/WorksetContentsPanel.tsx → ../dashboard/components/WorksetDetailSections (dashboard)",
]);

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

/**
 * Resolve the spec to a path and report the owning feature when it is a
 * different one. Resolving (rather than string matching) keeps nested folders
 * named after a feature — e.g. `sources/rss/providers/shared` — from tripping
 * the guard.
 */
function resolveCrossFeature(
  fromFile: string,
  fromFeature: string,
  spec: string,
): string | null {
  let absolute: string;
  if (spec.startsWith(".")) {
    absolute = resolve(dirname(fromFile), spec);
  } else if (spec.includes("/pages/")) {
    absolute = resolve(PAGES_DIR, spec.slice(spec.indexOf("/pages/") + "/pages/".length));
  } else {
    return null;
  }
  const rel = relative(PAGES_DIR, absolute).replace(/\\/g, "/");
  if (rel === "" || rel.startsWith("..")) return null;
  const owner = rel.split("/")[0];
  if (owner === fromFeature) return null;
  return FEATURES.includes(owner) ? owner : null;
}

function importsSettingsShared(spec: string): boolean {
  return (
    spec === "../settings/SettingsShared" ||
    spec.endsWith("/settings/SettingsShared") ||
    spec.includes("/pages/settings/SettingsShared")
  );
}

function eachImport(feature: string, visit: (file: string, spec: string) => void): void {
  const featureRoot = join(PAGES_DIR, feature);
  let files: string[];
  try {
    files = walkSourceFiles(featureRoot);
  } catch {
    return;
  }
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    IMPORT_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = IMPORT_RE.exec(source)) !== null) {
      visit(file, match[1]);
    }
  }
}

function displayPath(file: string): string {
  return relative(resolve(__dirname, ".."), file).replace(/\\/g, "/");
}

describe("page feature cross-imports", () => {
  it("covers every page directory except the shared chrome", () => {
    expect(FEATURES.length).toBeGreaterThanOrEqual(15);
    expect(FEATURES).not.toContain("shared");
  });

  it("page feature production code stays feature-local", () => {
    const violations: string[] = [];

    for (const feature of FEATURES) {
      eachImport(feature, (file, spec) => {
        const other = resolveCrossFeature(file, feature, spec);
        if (other) {
          const report = `${displayPath(file)} → ${spec} (${other})`;
          if (!ALLOWED_CROSS_FEATURE.has(report)) {
            violations.push(report);
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it("no feature imports the settings page shell — use components/settings", () => {
    const violations: string[] = [];

    for (const feature of FEATURES) {
      if (feature === "settings") continue;
      eachImport(feature, (file, spec) => {
        if (importsSettingsShared(spec)) {
          violations.push(`${displayPath(file)} → ${spec}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
