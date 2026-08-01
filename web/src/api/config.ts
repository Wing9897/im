/**
 * REST API client functions for configuration management.
 *
 * Requirements: 12.1, 12.4
 */

import { apiClient } from "./client";
import type { SystemSettingsSnapshot, SystemSettingsUpdate } from "../types";

// ─── Settings ─────────────────────────────────────────────────────────

/** Fetches the complete system settings snapshot from the backend. */
export function fetchSystemSettings(): Promise<SystemSettingsSnapshot> {
  return apiClient.get<SystemSettingsSnapshot>("/api/v1/config/settings");
}

/** Saves updated system settings and returns the persisted snapshot. */
export function saveSystemSettings(
  settings: SystemSettingsUpdate,
): Promise<SystemSettingsSnapshot> {
  return apiClient.put<SystemSettingsSnapshot>("/api/v1/config/settings", settings);
}
