/** Sources page type definitions (Telegram, Discord, RSS, HTTP, MQTT, Email, …). */

import type { components } from "../api/generated/schema";
import type { ConnectionStatus } from "./common";

type SourceResponse = components["schemas"]["SourceResponse"];

/** Collector source wire fields plus transient reconnecting UI state. */
export type Source = Omit<SourceResponse, "status"> & {
  status: ConnectionStatus;
};

export type SourceCredentials = components["schemas"]["TelegramCredentials"];
export type TelegramQrCredentials =
  components["schemas"]["TelegramQrCredentials"];
export type AddSourceResponse = components["schemas"]["AddSourceResponse"];
export type RefreshAllSourcesResponse =
  components["schemas"]["RefreshAllSourcesResponse"];

type WithLiveSource<T extends { source: unknown }> = Omit<T, "source"> & {
  /** Source cards may overlay the transient SSE-only "connecting" status. */
  source: Source;
};

/** Sources page tab keys — FE collector platform SoT (BE drift-tested). */
export type { CollectorPlatform as SourceTabKey } from "../domain/sources/collectorPlatforms";

/** Response from create_rss_feed command */
export type AddRssFeedResponse = WithLiveSource<
  components["schemas"]["AddRssFeedResponse"]
>;

/** Information about a single RSS feed */
export type RssFeedInfo = WithLiveSource<
  components["schemas"]["RssFeedInfoResponse"]
>;

/** Patch payload for editing an RSS feed */
export type RssFeedPatch = components["schemas"]["RssFeedPatchBody"];

/** Response from create/update HTTP poll source */
export type AddHttpSourceResponse = WithLiveSource<
  components["schemas"]["AddHttpSourceResponse"]
>;

/** Information about a single HTTP poll source */
export type HttpSourceInfo = WithLiveSource<
  components["schemas"]["HttpSourceInfoResponse"]
>;

/** Patch payload for editing an HTTP poll source */
export type HttpSourcePatch =
  components["schemas"]["HttpSourcePatchBody"];

/** Response from create_discord_bot command */
export type AddDiscordBotResponse = WithLiveSource<
  components["schemas"]["AddDiscordBotResponse"]
>;

/** Information about a connected Discord bot */
export type DiscordBotInfo = WithLiveSource<
  components["schemas"]["DiscordBotInfoResponse"]
>;

/** Information about a single MQTT broker source */
export type MqttBrokerInfo = WithLiveSource<
  components["schemas"]["MqttBrokerInfoResponse"]
>;

/** Patch payload for editing an MQTT broker */
export type MqttBrokerPatch =
  components["schemas"]["MqttBrokerPatchBody"];

/** Response from create_mqtt_broker */
export type AddMqttBrokerResponse = WithLiveSource<
  components["schemas"]["AddMqttBrokerResponse"]
>;

/** Response from create/update email mailbox */
export type AddEmailMailboxResponse = WithLiveSource<
  components["schemas"]["AddEmailMailboxResponse"]
>;

/** Information about a connected IMAP email mailbox */
export type EmailMailboxInfo = WithLiveSource<
  components["schemas"]["EmailMailboxInfoResponse"]
>;

/** Patch payload for editing an email mailbox */
export type EmailMailboxPatch =
  components["schemas"]["EmailMailboxPatchBody"];

/** Information about a Discord text channel */
export type DiscordChannelInfo =
  components["schemas"]["DiscordChannelInfoResponse"];
