import { DiscordTab } from "../discord/DiscordTab";
import { MqttTab } from "../mqtt/MqttTab";
import { RssTab } from "../rss/RssTab";
import { HttpPlatformTab } from "../http/HttpPlatformTab";
import { EmailTab } from "../email/EmailTab";
import { TelegramTab } from "../telegram/TelegramTab";
import { COLLECTOR_PLATFORM_ORDER } from "../../../domain/sources/collectorPlatforms";
import type { SourceTabKey } from "../../../types/sources";
import type { SourcePlatformPlugin } from "./types";

/**
 * Registered source-platform plugins for SourceManagementPage.
 * Order follows ``COLLECTOR_PLATFORM_ORDER`` (BE ``COLLECTOR_PLATFORMS``).
 * HTTP poll + inbound Webhook share one tab (`HttpPlatformTab`).
 */
const PLUGIN_TAB_BY_ID: Record<SourceTabKey, SourcePlatformPlugin["Tab"]> = {
  telegram: TelegramTab,
  discord: DiscordTab,
  rss: RssTab,
  http: HttpPlatformTab,
  mqtt: MqttTab,
  email: EmailTab,
};

const SOURCE_PLATFORM_PLUGINS: readonly SourcePlatformPlugin[] = COLLECTOR_PLATFORM_ORDER.map(
  (id) => ({ id, Tab: PLUGIN_TAB_BY_ID[id] }),
);

const PLUGIN_BY_ID = new Map<SourceTabKey, SourcePlatformPlugin>(
  SOURCE_PLATFORM_PLUGINS.map((plugin) => [plugin.id, plugin]),
);

export const SOURCE_TAB_ORDER: readonly SourceTabKey[] = COLLECTOR_PLATFORM_ORDER;

export function getSourcePlatformPlugin(id: SourceTabKey): SourcePlatformPlugin {
  const plugin = PLUGIN_BY_ID.get(id);
  if (!plugin) {
    throw new Error(`No SourcePlatformPlugin registered for tab "${id}"`);
  }
  return plugin;
}

export function isSourceTabKey(value: string | null): value is SourceTabKey {
  return value != null && PLUGIN_BY_ID.has(value as SourceTabKey);
}
