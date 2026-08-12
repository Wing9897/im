/**
 * Guard: FE DEFAULT_API_PORT must match server.constants.SERVICE_PORT and the
 * Node scripts/service-ports.mjs mirror (ICS-style cross-layer drift check).
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_API_PORT, defaultApiBaseUrl } from "./serviceEndpoints";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../");

function parsePythonServicePort(source: string): number {
  const match = source.match(/^SERVICE_PORT\s*=\s*(\d+)\s*$/m);
  if (!match) {
    throw new Error("SERVICE_PORT not found in server/constants.py");
  }
  return Number(match[1]);
}

function parseMjsServicePort(source: string): number {
  const match = source.match(/^export const SERVICE_PORT\s*=\s*(\d+)\s*;\s*$/m);
  if (!match) {
    throw new Error("SERVICE_PORT not found in scripts/service-ports.mjs");
  }
  return Number(match[1]);
}

describe("DEFAULT_API_PORT cross-layer drift", () => {
  it("matches server/constants.py and scripts/service-ports.mjs", () => {
    const pyPort = parsePythonServicePort(
      readFileSync(resolve(REPO_ROOT, "server/constants.py"), "utf8"),
    );
    const mjsPort = parseMjsServicePort(
      readFileSync(resolve(REPO_ROOT, "scripts/service-ports.mjs"), "utf8"),
    );
    expect(pyPort).toBe(18820);
    expect(DEFAULT_API_PORT).toBe(pyPort);
    expect(mjsPort).toBe(pyPort);
    expect(defaultApiBaseUrl()).toBe(`http://127.0.0.1:${pyPort}`);
  });

  it("keeps i18n server-url placeholders on the default port", () => {
    const portToken = `:${DEFAULT_API_PORT}`;
    for (const locale of ["en", "zh-Hans", "zh-Hant"] as const) {
      const common = readFileSync(
        resolve(REPO_ROOT, `web/src/i18n/locales/${locale}/common.json`),
        "utf8",
      );
      expect(common, locale).toContain(portToken);
    }
  });
});

