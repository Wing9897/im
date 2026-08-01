/** Sources page type definitions (Telegram, Discord, RSS, HTTP, MQTT, Email, …). */

import type { components } from "../api/generated/schema";
import type { Account } from "./accounts";

type WithLiveAccount<T extends { account: unknown }> = Omit<T, "account"> & {
  /** Source cards may overlay the transient SSE-only "connecting" status. */
  account: Account;
};

/** Sources page tab keys — FE collector platform SoT (BE drift-tested). */
export type { CollectorPlatform as SourceTabKey } from "../domain/sources/collectorPlatforms";

/** Response from create_rss_feed command */
export type AddRssFeedResponse = WithLiveAccount<
  components["schemas"]["AddRssFeedResponse"]
>;

/** Information about a single RSS feed */
export type RssFeedInfo = WithLiveAccount<
  components["schemas"]["RssFeedInfoResponse"]
>;

/** Patch payload for editing an RSS feed */
export type RssFeedPatch = components["schemas"]["RssFeedPatchBody"];

/** Response from create/update HTTP poll source */
export type AddHttpSourceResponse = WithLiveAccount<
  components["schemas"]["AddHttpSourceResponse"]
>;

/** Information about a single HTTP poll source */
export type HttpSourceInfo = WithLiveAccount<
  components["schemas"]["HttpSourceInfoResponse"]
>;

/** Patch payload for editing an HTTP poll source */
export type HttpSourcePatch =
  components["schemas"]["HttpSourcePatchBody"];

/** Response from create_discord_bot command */
export type AddDiscordBotResponse = WithLiveAccount<
  components["schemas"]["AddDiscordBotResponse"]
>;

/** Information about a connected Discord bot */
export type DiscordBotInfo = WithLiveAccount<
  components["schemas"]["DiscordBotInfoResponse"]
>;

/** Information about a single MQTT broker source */
export type MqttBrokerInfo = WithLiveAccount<
  components["schemas"]["MqttBrokerInfoResponse"]
>;

/** Patch payload for editing an MQTT broker */
export type MqttBrokerPatch =
  components["schemas"]["MqttBrokerPatchBody"];

/** Response from create_mqtt_broker */
export type AddMqttBrokerResponse = WithLiveAccount<
  components["schemas"]["AddMqttBrokerResponse"]
>;

/** Response from create/update email mailbox */
export type AddEmailMailboxResponse = WithLiveAccount<
  components["schemas"]["AddEmailMailboxResponse"]
>;

/** Information about a connected IMAP email mailbox */
export type EmailMailboxInfo = WithLiveAccount<
  components["schemas"]["EmailMailboxInfoResponse"]
>;

/** Patch payload for editing an email mailbox */
export type EmailMailboxPatch =
  components["schemas"]["EmailMailboxPatchBody"];

/** Information about a Discord text channel */
export type DiscordChannelInfo =
  components["schemas"]["DiscordChannelInfoResponse"];
