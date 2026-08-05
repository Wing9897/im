import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

describe("release safety gates", () => {
  it("keeps PR/main quality while release jobs require manual dispatch", () => {
    const workflow = readFileSync(
      resolve(ROOT, ".github/workflows/ci.yml"),
      "utf8",
    );
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("pull_request:");

    for (const job of ["version", "package", "release", "container"]) {
      expect(workflow).toMatch(
        new RegExp(
          `\\n  ${job}:\\n    if: github\\.event_name == 'workflow_dispatch'`,
        ),
      );
    }
    expect(workflow).not.toContain("refs/heads/main");
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
