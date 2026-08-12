/** Session-auth MCP status probe for Settings UI (no access key required). */

import { apiClient } from "./client";
import type { components } from "./generated/schema";

export type McpStatusTool = components["schemas"]["McpStatusTool"];
export type McpStatusResponse = components["schemas"]["McpStatusResponse"];

/** GET /api/v1/mcp/status — master switch + currently exposed tools. */
export function fetchMcpStatus(): Promise<McpStatusResponse> {
  return apiClient.get<McpStatusResponse>("/api/v1/mcp/status");
}
