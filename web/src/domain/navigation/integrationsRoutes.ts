/** Settings → 外部接口 SoT: `/settings/integrations?tab=webhook|a2a|deeplink|mcp`. */

export const SETTINGS_INTEGRATIONS_PATH = "/settings/integrations";

export const INTEGRATION_TABS = ["webhook", "a2a", "deeplink", "mcp"] as const;

export type IntegrationTabKey = (typeof INTEGRATION_TABS)[number];

export const DEFAULT_INTEGRATION_TAB: IntegrationTabKey = "webhook";

export function isIntegrationTabKey(value: string | null): value is IntegrationTabKey {
  return value != null && (INTEGRATION_TABS as readonly string[]).includes(value);
}

export function settingsIntegrationsPath(
  tab: IntegrationTabKey = DEFAULT_INTEGRATION_TAB,
): string {
  return `${SETTINGS_INTEGRATIONS_PATH}?tab=${tab}`;
}

export const SETTINGS_API_REDIRECT = settingsIntegrationsPath("webhook");
export const SETTINGS_MCP_REDIRECT = settingsIntegrationsPath("mcp");
