/**
 * Settings key contract: CONFIG_DEFAULTS ∩ Settings wire ∩ generated OpenAPI snapshot.
 *
 * Mirrors server/tests/test_contract_config.py::test_settings_keys_align_across_config_api_and_frontend
 * so the web package catches drift without requiring a pytest run.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { defaultSettingsSnapshot } from "../../test/settingsSnapshot";
import type { SystemSettingsSnapshot } from "../../types/settings";
import {
  parseConfigDefaultsKeys,
  parseGeneratedSettingsSnapshotKeys,
  parseMcpCapabilitySettingsKeys,
  parseSettingsWireMap,
} from "./settingsKeyContract";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");

/** Keys in CONFIG_DEFAULTS that are intentionally not on the Settings wire. */
const INTERNAL_CONFIG_KEYS = new Set([
  "localhost_auth_exempt",
  "setup_complete",
  "agent_max_tool_rounds",
  "agent_max_drain_waves",
]);

/** Retired CONFIG_DEFAULTS keys that must stay absent (mirror server _RETIRED_CONFIG_KEYS). */
const RETIRED_CONFIG_KEYS = new Set([
  "analysis_spatiotemporal_mode",
  "auto_pause_on_rate_limit",
  "data_retention_days",
  "ingestion_api_key",
  "access_api_keys",
  "assistant_sessions",
  "ops_board_layout",
  "ops_board_widget_state",
  "voice_reminder_settings",
  "voice_reminder_fired",
  "voice_reminder_trigger_history",
  "assistant_voice_io_settings",
  "timeline_annotations",
  "batch_overlap_count",
  "agent_project_wave_interval_seconds",
  "intelligence_rules_version",
  // Stamp 29: LLM connection slots moved to llm_profiles.
  "llm_provider",
  "ollama_base_url",
  "ollama_model",
  "ollama_thinking_enabled",
  "openai_base_url",
  "openai_model",
  "openai_api_key",
  "openai_json_mode",
  "gemini_base_url",
  "gemini_model",
  "gemini_api_key",
  "openrouter_base_url",
  "openrouter_model",
  "openrouter_api_key",
  "assistant_llm_provider",
  "assistant_llm_base_url",
  "assistant_llm_model",
  "assistant_llm_api_key",
  "assistant_web_search_enabled",
  "web_search_provider",
  "brave_search_api_key",
]);

describe("settings key contract", () => {
  const generatedSchema = readFileSync(
    resolve(REPO_ROOT, "web/src/api/generated/schema.d.ts"),
    "utf8",
  );
  const configRoutes = readFileSync(
    resolve(REPO_ROOT, "server/api/routes/config.py"),
    "utf8",
  );
  const configDefaults = readFileSync(resolve(REPO_ROOT, "server/config.py"), "utf8");
  const mcpCapabilities = readFileSync(
    resolve(REPO_ROOT, "server/domain/mcp_capabilities.py"),
    "utf8",
  );

  const snapshotKeys = parseGeneratedSettingsSnapshotKeys(generatedSchema);
  const wireMap = parseSettingsWireMap(configRoutes);
  const mcpWireMap = parseMcpCapabilitySettingsKeys(mcpCapabilities);
  // Capability toggles are spread via ``**MCP_CAPABILITY_SETTINGS_KEYS``.
  for (const [wireKey, configKey] of mcpWireMap) {
    wireMap.set(wireKey, configKey);
  }
  const wireKeys = new Set(wireMap.keys());
  const configKeys = new Set(wireMap.values());
  const defaultsKeys = parseConfigDefaultsKeys(configDefaults);
  for (const configKey of mcpWireMap.values()) {
    defaultsKeys.add(configKey);
  }

  it("generated SystemSettingsSnapshot keys match Settings wire keys", () => {
    expect(snapshotKeys).toEqual(wireKeys);
  });

  it("defaultSettingsSnapshot covers every SystemSettingsSnapshot key", () => {
    const runtimeKeys = new Set(
      Object.keys(defaultSettingsSnapshot) as (keyof SystemSettingsSnapshot)[],
    );
    expect(runtimeKeys).toEqual(snapshotKeys);
  });

  it("every Settings wire config key exists in CONFIG_DEFAULTS", () => {
    for (const configKey of configKeys) {
      expect(defaultsKeys.has(configKey), `missing CONFIG_DEFAULTS entry: ${configKey}`).toBe(
        true,
      );
    }
  });

  it("CONFIG_DEFAULTS minus internal keys equals Settings wire config keys", () => {
    const exposed = new Set(
      [...defaultsKeys].filter((key) => !INTERNAL_CONFIG_KEYS.has(key)),
    );
    expect(exposed).toEqual(configKeys);
  });

  it("retired config keys stay absent from CONFIG_DEFAULTS", () => {
    for (const key of RETIRED_CONFIG_KEYS) {
      expect(defaultsKeys.has(key), `retired key still in CONFIG_DEFAULTS: ${key}`).toBe(
        false,
      );
    }
  });
});
