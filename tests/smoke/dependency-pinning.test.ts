import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Dependency version pinning.
 *
 * Runtime dependencies must be pinned to exact versions so production builds
 * are reproducible. The root package.json has no runtime `dependencies`
 * (workspace tooling only), so this checks the two real runtime manifests:
 *   1. web/package.json `dependencies` — exact semver (no ^, ~, ranges)
 *   2. pyproject.toml `[project] dependencies` — `name==version` pins
 *
 * devDependencies are intentionally not covered: range specifiers are
 * acceptable for tooling.
 */

const ROOT_DIR = path.resolve(__dirname, "../..");

/** Exact semver: major.minor.patch with optional pre-release/build metadata. */
const EXACT_SEMVER_REGEX = /^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/;

function readProjectDependencySpecs(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const projectStart = lines.findIndex((line) => line.trim() === "[project]");
  expect(projectStart, "pyproject.toml must declare a [project] table").toBeGreaterThanOrEqual(0);
  const nextTableOffset = lines
    .slice(projectStart + 1)
    .findIndex((line) => /^\s*\[[^\]]+\]\s*$/.test(line));
  const projectEnd = nextTableOffset === -1 ? lines.length : projectStart + 1 + nextTableOffset;

  const dependenciesStart = lines.findIndex(
    (line, index) =>
      index > projectStart &&
      index < projectEnd &&
      /^\s*dependencies\s*=\s*\[\s*$/.test(line),
  );
  expect(
    dependenciesStart,
    "pyproject.toml must declare a [project] dependencies array",
  ).toBeGreaterThan(projectStart);

  const dependenciesEnd = lines.findIndex(
    (line, index) =>
      index > dependenciesStart &&
      index < projectEnd &&
      line.trim() === "]",
  );
  expect(
    dependenciesEnd,
    "pyproject.toml [project] dependencies array must be closed",
  ).toBeGreaterThan(dependenciesStart);

  const dependencyLines = lines
    .slice(dependenciesStart + 1, dependenciesEnd)
    .filter((line) => line.trim() !== "" && !line.trim().startsWith("#"));
  const parsed = dependencyLines.map((line) =>
    line.match(/^\s*"([^"]+)"\s*,?\s*(?:#.*)?$/),
  );
  const invalidLines = dependencyLines.filter((_, index) => parsed[index] === null);
  expect(
    invalidLines,
    `unparseable [project] dependency lines:\n${invalidLines.map((line) => `  - ${line}`).join("\n")}`,
  ).toEqual([]);

  return parsed.map((match) => match![1]);
}

describe("Dependency version pinning", () => {
  it("web/package.json runtime dependencies use exact versions", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(ROOT_DIR, "web", "package.json"), "utf-8"),
    );
    const dependencies: Record<string, string> = pkg.dependencies ?? {};
    const entries = Object.entries(dependencies);

    // Guard against the check silently becoming vacuous again.
    expect(entries.length, "web/package.json should declare runtime dependencies").toBeGreaterThan(0);

    const violations = entries
      .filter(([, version]) => !EXACT_SEMVER_REGEX.test(version))
      .map(([name, version]) => `${name}: "${version}"`);

    expect(
      violations,
      `web runtime dependencies with non-exact versions:\n${violations.map((v) => `  - ${v}`).join("\n")}`,
    ).toEqual([]);
  });

  it("pyproject.toml server dependencies are ==-pinned", () => {
    const content = fs.readFileSync(path.resolve(ROOT_DIR, "pyproject.toml"), "utf-8");
    const specs = readProjectDependencySpecs(content);
    expect(specs.length, "pyproject.toml should declare server dependencies").toBeGreaterThan(0);

    // Each spec must be `name==version` (extras like uvicorn[standard] allowed).
    const violations = specs.filter(
      (spec) => !/^[A-Za-z0-9._-]+(?:\[[^\]]+\])?==\S+$/.test(spec),
    );

    expect(
      violations,
      `server dependencies without == pins:\n${violations.map((v) => `  - ${v}`).join("\n")}`,
    ).toEqual([]);
  });
});
