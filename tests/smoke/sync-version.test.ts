import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = resolve(__dirname, "../../scripts/sync-version.mjs");

function write(root: string, relativePath: string, content: string): void {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}

describe("sync-version", () => {
  it("updates every version authority inside an isolated repository", () => {
    const root = mkdtempSync(join(tmpdir(), "im-sync-version-"));
    write(root, "VERSION", "2.3.4-beta.5\n");
    for (const manifest of ["package.json", "web/package.json", "desktop/package.json"]) {
      write(root, manifest, '{"name":"fixture","version":"0.0.0"}\n');
    }
    write(root, "pyproject.toml", '[project]\nname = "fixture"\nversion = "0.0.0"\n');
    write(
      root,
      "package-lock.json",
      JSON.stringify({
        version: "0.0.0",
        packages: {
          "": { version: "0.0.0" },
          web: { name: "intelligence-monitor-web", version: "0.0.0" },
          desktop: { name: "intelligence-monitor-desktop", version: "0.0.0" },
        },
      }),
    );
    write(
      root,
      "uv.lock",
      '[[package]]\nname = "intelligence-monitor-server"\nversion = "0.0.0"\n',
    );
    write(root, "web/openapi/openapi.json", '{"info":{"version":"0.0.0"}}\n');

    execFileSync(process.execPath, [SCRIPT, "--root", root], { stdio: "pipe" });

    expect(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version).toBe(
      "2.3.4-beta.5",
    );
    expect(readFileSync(join(root, "pyproject.toml"), "utf8")).toContain(
      'version = "2.3.4-beta.5"',
    );
    expect(readFileSync(join(root, "uv.lock"), "utf8")).toContain(
      'version = "2.3.4b5"',
    );
    expect(
      JSON.parse(readFileSync(join(root, "web/openapi/openapi.json"), "utf8")).info
        .version,
    ).toBe("2.3.4-beta.5");
  });

  it("rejects an invalid VERSION before modifying manifests", () => {
    const root = mkdtempSync(join(tmpdir(), "im-sync-version-invalid-"));
    write(root, "VERSION", "not-semver\n");

    expect(() =>
      execFileSync(process.execPath, [SCRIPT, "--root", root], { stdio: "pipe" }),
    ).toThrow();
  });
});
