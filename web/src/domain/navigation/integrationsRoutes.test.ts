import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_INTEGRATION_TAB,
  isIntegrationTabKey,
  SETTINGS_INTEGRATIONS_PATH,
  settingsIntegrationsPath,
} from "./integrationsRoutes";

describe("integrationsRoutes", () => {
  it("uses /settings/integrations with tab query as SoT", () => {
    expect(SETTINGS_INTEGRATIONS_PATH).toBe("/settings/integrations");
    expect(DEFAULT_INTEGRATION_TAB).toBe("webhook");
    expect(settingsIntegrationsPath()).toBe("/settings/integrations?tab=webhook");
    expect(settingsIntegrationsPath("mcp")).toBe("/settings/integrations?tab=mcp");
  });

  it("does not export legacy /settings/api or /settings/mcp redirects", () => {
    const src = readFileSync(resolve(__dirname, "./integrationsRoutes.ts"), "utf8");
    expect(src).not.toContain("SETTINGS_API_REDIRECT");
    expect(src).not.toContain("SETTINGS_MCP_REDIRECT");
    expect(src).not.toContain("/settings/api");
    expect(src).not.toContain("/settings/mcp");
  });

  it("accepts only the five integration tabs", () => {
    expect(isIntegrationTabKey("webhook")).toBe(true);
    expect(isIntegrationTabKey("a2a")).toBe(true);
    expect(isIntegrationTabKey("deeplink")).toBe(true);
    expect(isIntegrationTabKey("mcp")).toBe(true);
    expect(isIntegrationTabKey("system")).toBe(true);
    expect(settingsIntegrationsPath("system")).toBe("/settings/integrations?tab=system");
    expect(isIntegrationTabKey("api")).toBe(false);
    expect(isIntegrationTabKey(null)).toBe(false);
  });
});
