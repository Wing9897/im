import { describe, expect, it } from "vitest";
import {
  DEFAULT_INTEGRATION_TAB,
  isIntegrationTabKey,
  SETTINGS_API_REDIRECT,
  SETTINGS_INTEGRATIONS_PATH,
  SETTINGS_MCP_REDIRECT,
  settingsIntegrationsPath,
} from "./integrationsRoutes";

describe("integrationsRoutes", () => {
  it("uses /settings/integrations with tab query as SoT", () => {
    expect(SETTINGS_INTEGRATIONS_PATH).toBe("/settings/integrations");
    expect(DEFAULT_INTEGRATION_TAB).toBe("webhook");
    expect(settingsIntegrationsPath()).toBe("/settings/integrations?tab=webhook");
    expect(settingsIntegrationsPath("mcp")).toBe("/settings/integrations?tab=mcp");
  });

  it("keeps legacy API and MCP paths as explicit redirects", () => {
    expect(SETTINGS_API_REDIRECT).toBe("/settings/integrations?tab=webhook");
    expect(SETTINGS_MCP_REDIRECT).toBe("/settings/integrations?tab=mcp");
  });

  it("accepts only the four integration tabs", () => {
    expect(isIntegrationTabKey("webhook")).toBe(true);
    expect(isIntegrationTabKey("a2a")).toBe(true);
    expect(isIntegrationTabKey("deeplink")).toBe(true);
    expect(isIntegrationTabKey("mcp")).toBe(true);
    expect(isIntegrationTabKey("api")).toBe(false);
    expect(isIntegrationTabKey(null)).toBe(false);
  });
});
