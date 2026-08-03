/**
 * REST API client functions for account management, split per platform.
 * Barrel export preserves the historical `api/accounts` import path.
 */

export { listAccounts, deleteAccount, reconnectAccount, refreshAllAccounts } from "./core";
export {
  createTelegramAccount,
  createTelegramQrAccount,
  waitTelegramQrLogin,
  updateTelegramAccount,
  submitTelegramCode,
  submitTelegram2fa,
  listTelegramAccounts,
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
