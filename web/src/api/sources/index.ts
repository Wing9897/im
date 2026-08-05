/**
 * REST API client functions for source management, split per platform.
 * Barrel export preserves the historical `api/sources` import path.
 */

export { listSources, deleteSource, reconnectSource, refreshAllSources } from "./core";
export {
  createTelegramSource,
  createTelegramQrSource,
  waitTelegramQrLogin,
  updateTelegramSource,
  submitTelegramCode,
  submitTelegram2fa,
  listTelegramSources,
} from "./telegram";
export {
  createDiscordBot,
  updateDiscordBot,
  subscribeDiscordChannels,
  listDiscordBots,
} from "./discord";
export { createMqttBroker, updateMqttBroker, listMqttBrokers } from "./mqtt";
export { createRssFeed, updateRssFeed, listRssFeeds } from "./rss";
export { createHttpSource, updateHttpSource, listHttpSources } from "./http";
export { createEmailMailbox, updateEmailMailbox, listEmailMailboxes } from "./email";
