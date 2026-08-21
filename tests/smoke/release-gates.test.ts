import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

function readWorkflow(name: string): string {
  return readFileSync(resolve(ROOT, ".github/workflows", name), "utf8");
}

describe("release safety gates", () => {
  it("keeps PR/main CI as quality-only (no publish jobs)", () => {
    const workflow = readWorkflow("ci.yml");
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("uses: ./.github/workflows/quality.yml");
    expect(workflow).not.toContain("softprops/action-gh-release");
    expect(workflow).not.toContain("ghcr.io");
    expect(workflow).not.toMatch(/^ {2}package:/m);
    expect(workflow).not.toMatch(/^ {2}release:/m);
    expect(workflow).not.toMatch(/^ {2}container:/m);
    expect(workflow).not.toContain("refs/heads/main");
  });

  it("publishes from Release workflow on v* tags (tag exists before package)", () => {
    const workflow = readWorkflow("release.yml");
    expect(workflow).toContain("tags:");
    expect(workflow).toContain('"v*.*.*"');
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("uses: ./.github/workflows/quality.yml");
    expect(workflow).toMatch(/\n  tag:\n    needs: \[quality, version\]/);
    expect(workflow).toMatch(/\n  package:\n    needs: \[quality, version, tag\]/);
    expect(workflow).toContain("softprops/action-gh-release");
    expect(workflow).toContain("git push origin");
    expect(workflow).toContain("ghcr.io");
    expect(workflow).not.toContain("if: github.event_name == 'workflow_dispatch'");
  });

  it("keeps the Docker Node image aligned with .nvmrc", () => {
    const nodeVersion = readFileSync(resolve(ROOT, ".nvmrc"), "utf8").trim();
    const dockerfile = readFileSync(resolve(ROOT, "Dockerfile"), "utf8");
    expect(dockerfile).toContain(`ARG NODE_VERSION=${nodeVersion}`);
  });

  it("runs aggregate test gates serially and makes fast verify self-contained", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(ROOT, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts["test:all"]).not.toContain("concurrently");
    expect(pkg.scripts["test:coverage"]).not.toContain("concurrently");
    expect(pkg.scripts["verify:desktop:fast"]).toMatch(/^npm run build && /);
  });
});
