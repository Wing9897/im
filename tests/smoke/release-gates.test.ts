import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

function readWorkflow(name: string): string {
  return readFileSync(resolve(ROOT, ".github/workflows", name), "utf8");
}

describe("release safety gates", () => {
  it("keeps PR CI as quality-only (no publish jobs)", () => {
    const workflow = readWorkflow("ci.yml");
    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("uses: ./.github/workflows/quality.yml");
    expect(workflow).not.toContain("softprops/action-gh-release");
    expect(workflow).not.toContain("ghcr.io");
    expect(workflow).not.toMatch(/^ {2}package:/m);
    expect(workflow).not.toMatch(/^ {2}release:/m);
    expect(workflow).not.toMatch(/^ {2}container:/m);
    expect(workflow).not.toContain("refs/heads/main");
  });

  it("publishes on push to main: tag then three Desktop packages", () => {
    const workflow = readWorkflow("release.yml");
    expect(workflow).toContain("branches: [main]");
    expect(workflow).not.toContain("workflow_run:");
    expect(workflow).toContain("Generate tag version");
    expect(workflow).toContain("name: Create and push tag");
    expect(workflow).toContain('git push origin "refs/tags/${TAG}"');
    expect(workflow).toMatch(/\n  web_dist:\n/);
    expect(workflow).toMatch(/\n  package:\n    needs: \[tag, web_dist\]/);
    expect(workflow).toContain("windows-latest");
    expect(workflow).toContain("macos-latest");
    expect(workflow).toContain("ubuntu-latest");
    expect(workflow).toContain("dist:win:native");
    expect(workflow).toContain("dist:mac:native");
    expect(workflow).toContain("dist:linux:native");
    expect(workflow).toContain("name: Create GitHub Release");
    expect(workflow).toContain("name: Upload to GitHub Release");
    expect(workflow).toContain("gh release create");
    expect(workflow).not.toContain("softprops/action-gh-release");
    expect(workflow).toContain("desktop/release/*.exe");
    expect(workflow).toContain("GH_REPO: ${{ github.repository }}");
    expect(workflow).not.toContain("upload-artifact");
    expect(workflow).not.toContain("actions/upload-artifact");
    expect(workflow).not.toContain("actions/download-artifact");
    expect(workflow).not.toContain("type=gha");
    expect(workflow).toContain("web-dist.tar.gz");
    expect(workflow).toContain("gh release upload");
    expect(workflow).toContain("gh release download");
    expect(workflow).toContain('gh release delete-asset "$TAG" web-dist.tar.gz --yes || true');
    expect(workflow).toContain("if: always() && needs.tag.result == 'success'");
    expect(workflow).toContain("if: needs.package.result == 'success'");
    expect(workflow).toContain("Keep web-dist for failed-job reruns");
    expect(workflow).toContain("retry gh release upload");
    expect(workflow).toContain("Upload attempt");
    expect(workflow).not.toMatch(
      /name: Delete staged web-dist\.tar\.gz\r?\n\s+if: always\(\)/,
    );
    expect(workflow).toContain("python3 scripts/bump_version.py --from-tags --print-only");
    expect(workflow).toContain("required: false");

    expect(workflow).not.toContain("package:cli");
    expect(workflow).not.toContain("if: github.event_name == 'workflow_dispatch'");
    expect(workflow).not.toContain("tauri-apps/tauri-action");
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
    expect(pkg.scripts["dist:win"]).toMatch(/^npm run build:web && /);
    expect(pkg.scripts["dist:mac"]).toMatch(/^npm run build:web && /);
    expect(pkg.scripts["dist:linux"]).toMatch(/^npm run build:web && /);
    expect(pkg.scripts["dist:win:native"]).toBe(
      "npm run dist:win --workspace desktop",
    );
    expect(pkg.scripts["dist:mac:native"]).toBe(
      "npm run dist:mac --workspace desktop",
    );
    expect(pkg.scripts["dist:linux:native"]).toBe(
      "npm run dist:linux --workspace desktop",
    );
  });
});
