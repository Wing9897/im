#!/usr/bin/env node
/**
 * Fail when committed OpenAPI artifacts drift from a fresh export + types generate.
 *
 * Compares:
 *   - web/openapi/openapi.json
 *   - web/src/api/generated/schema.d.ts
 *
 * Against live FastAPI OpenAPI + openapi-typescript output written to a temp dir.
 * On drift, exits non-zero and suggests `npm run openapi:generate`.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMMITTED_OPENAPI = join(ROOT, "web", "openapi", "openapi.json");
const COMMITTED_SCHEMA = join(ROOT, "web", "src", "api", "generated", "schema.d.ts");

function normalizeNewlines(text) {
  return text.replace(/\r\n/g, "\n");
}

function normalizeOpenApiJson(text) {
  const parsed = JSON.parse(text);
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
    ...options,
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    console.error(`Command failed: ${command} ${args.join(" ")}`);
    if (detail) console.error(detail);
    process.exit(result.status ?? 1);
  }
  return result;
}

function main() {
  const tmp = mkdtempSync(join(tmpdir(), "im-openapi-check-"));
  const liveOpenapi = join(tmp, "openapi.json");
  const liveSchema = join(tmp, "schema.d.ts");

  try {
    run("uv", ["run", "python", "scripts/export_openapi.py", "--output", liveOpenapi]);
    run("npm", [
      "exec",
      "--workspace",
      "web",
      "--",
      "openapi-typescript",
      liveOpenapi,
      "-o",
      liveSchema,
    ]);

    const committedOpenapiNorm = normalizeOpenApiJson(
      readFileSync(COMMITTED_OPENAPI, "utf8"),
    );
    const liveOpenapiNorm = normalizeOpenApiJson(readFileSync(liveOpenapi, "utf8"));

    const committedSchemaNorm = normalizeNewlines(readFileSync(COMMITTED_SCHEMA, "utf8"));
    const liveSchemaNorm = normalizeNewlines(readFileSync(liveSchema, "utf8"));

    const drifts = [];
    if (committedOpenapiNorm !== liveOpenapiNorm) {
      drifts.push(relative(ROOT, COMMITTED_OPENAPI).replaceAll("\\", "/"));
    }
    if (committedSchemaNorm !== liveSchemaNorm) {
      drifts.push(relative(ROOT, COMMITTED_SCHEMA).replaceAll("\\", "/"));
    }

    if (drifts.length > 0) {
      console.error("OpenAPI drift detected:");
      for (const path of drifts) {
        console.error(`  - ${path}`);
      }
      console.error("Run: npm run openapi:generate");
      process.exit(1);
    }

    console.log("OpenAPI check OK (openapi.json + schema.d.ts match live export).");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main();
