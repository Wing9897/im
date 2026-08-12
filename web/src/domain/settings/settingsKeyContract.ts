/**
 * Parsers for the settings key contract (CONFIG_DEFAULTS ∩ Settings wire ∩ OpenAPI).
 * Used by settingsKeyContract.test.ts; keep regexes resilient to ``**`` spreads.
 */

export function linesOf(block: string): string[] {
  return block.split(/\r?\n/);
}

export function parseGeneratedSettingsSnapshotKeys(source: string): Set<string> {
  const match = source.match(
    /SystemSettingsSnapshot:\s*\{([\s\S]*?)^\s{8}\};/m,
  );
  if (!match) throw new Error("generated SystemSettingsSnapshot schema not found");
  return new Set(
    linesOf(match[1])
      .map((line) => line.match(/^\s{12}([A-Za-z]\w*)\??:/)?.[1])
      .filter((key): key is string => Boolean(key)),
  );
}

/** Literal wire→config pairs from ``_SETTINGS_KEYS`` (excludes ``**`` spreads). */
export function parseSettingsWireMap(source: string): Map<string, string> {
  const match = source.match(
    /_SETTINGS_KEYS:\s*dict\[str,\s*str\]\s*=\s*\{([\s\S]*?)\n\}/,
  );
  if (!match) throw new Error("_SETTINGS_KEYS not found in config routes");
  const map = new Map<string, string>();
  for (const line of linesOf(match[1])) {
    const m = line.match(/"(\w+)":\s*"(\w+)"/);
    if (m) map.set(m[1]!, m[2]!);
  }
  if (map.size === 0) throw new Error("_SETTINGS_KEYS parsed empty");
  return map;
}

/**
 * Wire/config pairs from ``MCP_CAPABILITY_SETTINGS_KEYS``.
 * Prefer the derived dict when it is a literal; otherwise fall back to
 * ``McpCapabilitySpec(id, config_key, wire_key)`` constructors.
 */
export function parseMcpCapabilitySettingsKeys(source: string): Map<string, string> {
  if (!source.includes("MCP_CAPABILITY_SETTINGS_KEYS")) {
    throw new Error("MCP_CAPABILITY_SETTINGS_KEYS not found");
  }
  const map = new Map<string, string>();
  const dictMatch = source.match(
    /MCP_CAPABILITY_SETTINGS_KEYS:\s*Final\[dict\[str,\s*str\]\]\s*=\s*\{([\s\S]*?)\n\}/,
  );
  if (dictMatch) {
    for (const line of linesOf(dictMatch[1])) {
      // Literal ``"wire": "config"`` entries (not ``spec.wire_key:`` comprehensions).
      const m = line.match(/^\s*"(\w+)":\s*"([a-z0-9_]+)"/);
      if (m) map.set(m[1]!, m[2]!);
    }
  }
  if (map.size === 0) {
    const ctorRe =
      /McpCapabilitySpec\(\s*"([^"]+)"\s*,\s*"([a-z0-9_]+)"\s*,\s*"(\w+)"\s*,?\s*\)/gs;
    for (const m of source.matchAll(ctorRe)) {
      map.set(m[3]!, m[2]!);
    }
  }
  if (map.size === 0) throw new Error("MCP capability settings keys parsed empty");
  return map;
}

export function parseConfigDefaultsKeys(source: string): Set<string> {
  const match = source.match(/CONFIG_DEFAULTS:\s*dict\[str,\s*str\]\s*=\s*\{([\s\S]*?)\n\}/);
  if (!match) throw new Error("CONFIG_DEFAULTS not found");
  const keys = new Set<string>();
  for (const line of linesOf(match[1])) {
    const m = line.match(/^\s*"([a-z0-9_]+)":/);
    if (m) keys.add(m[1]!);
  }
  if (keys.size === 0) throw new Error("CONFIG_DEFAULTS parsed empty");
  return keys;
}
