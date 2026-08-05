import type { Source } from "../../../types";
import type {
  DiscordBotInfo,
  EmailMailboxInfo,
  HttpSourceInfo,
  MqttBrokerInfo,
  RssFeedInfo,
} from "../../../types/sources";
import { formatSourceLabel } from "../../../utils/sourceDisplay";
import { platformDisplayLabel } from "../../../utils/platformRegistry";
import { formatStatusLabel } from "../../../styles/statusDot";
import { formatOsDateTime } from "../../../utils/time";
import i18n from "../../../i18n";
import type { DetailField } from "../types";

function t(key: string, vars?: Record<string, string | number>): string {
  return String(i18n.t(`sources:${key}`, vars));
}

function sourceMetaFields(source: Source): DetailField[] {
  return [
    { label: t("detail.status"), value: formatStatusLabel(source.status), standalone: true },
    { label: t("detail.platform"), value: platformDisplayLabel(source.platform), standalone: true },
    {
      label: t("detail.lastConnected"),
      value: source.lastConnectedAt
        ? formatOsDateTime(source.lastConnectedAt)
        : t("detail.neverConnected"),
    },
    {
      label: t("detail.lastError"),
      value: source.lastError ?? t("detail.emDash"),
      standalone: true,
    },
    { label: t("detail.createdAt"), value: formatOsDateTime(source.createdAt) },
    { label: t("detail.updatedAt"), value: formatOsDateTime(source.updatedAt) },
  ];
}

export function buildSourceDetailFields(source: Source): DetailField[] {
  return [
    { label: t("detail.displayName"), value: formatSourceLabel(source), standalone: true },
    ...sourceMetaFields(source),
  ];
}

export function buildEmailMailboxDetailFields(mailbox: EmailMailboxInfo): DetailField[] {
  const folderLines =
    mailbox.folders.length > 0
      ? mailbox.folders
          .map((folder) => {
            const cursor = mailbox.folderCursors[folder];
            return cursor != null
              ? t("detail.folderUid", { folder, cursor })
              : folder;
          })
          .join("\n")
      : t("detail.notSet");

  const channelLines =
    mailbox.channels.length > 0
      ? mailbox.channels.map((ch) => ch.channelName || ch.id).join("\n")
      : t("detail.emDash");

  const allowlist =
    mailbox.senderAllowlist.length > 0
      ? mailbox.senderAllowlist.join("\n")
      : t("detail.allowlistUnlimited");

  return [
    { label: t("detail.username"), value: mailbox.username, standalone: true },
    ...sourceMetaFields(mailbox.source),
    { label: t("detail.imapHost"), value: mailbox.imapHost, standalone: true },
    { label: t("detail.imapPort"), value: String(mailbox.imapPort), standalone: true },
    {
      label: t("detail.ssl"),
      value: mailbox.useSsl ? t("detail.yes") : t("detail.no"),
      standalone: true,
    },
    { label: t("detail.folders"), value: folderLines, standalone: true },
    {
      label: t("detail.pollInterval"),
      value: t("detail.everyMinutes", {
        minutes: Math.round(mailbox.pollIntervalSeconds / 60),
      }),
    },
    { label: t("detail.initialSyncDays"), value: String(mailbox.initialSyncDays) },
    { label: t("detail.initialSyncMax"), value: String(mailbox.initialSyncMaxMessages) },
    { label: t("detail.senderAllowlist"), value: allowlist },
    {
      label: t("detail.markAsRead"),
      value: mailbox.markAsRead ? t("detail.yes") : t("detail.no"),
    },
    { label: t("detail.channels"), value: channelLines, standalone: true },
    {
      label: t("detail.lastSuccess"),
      value: mailbox.lastSuccessAt
        ? formatOsDateTime(mailbox.lastSuccessAt)
        : t("detail.emDash"),
    },
    {
      label: t("detail.pollError"),
      value: mailbox.lastError ?? t("detail.emDash"),
      standalone: true,
    },
  ];
}

export function buildRssFeedDetailFields(feed: RssFeedInfo): DetailField[] {
  return [
    {
      label: t("detail.name"),
      value: formatSourceLabel(feed.source) || feed.feedUrl,
    },
    ...sourceMetaFields(feed.source),
    { label: t("detail.feedUrl"), value: feed.feedUrl },
    {
      label: t("detail.pollInterval"),
      value: t("detail.everyMinutes", {
        minutes: Math.round(feed.pollIntervalSeconds / 60),
      }),
    },
    {
      label: t("detail.lastSuccess"),
      value: feed.lastSuccessAt
        ? formatOsDateTime(feed.lastSuccessAt)
        : t("detail.emDash"),
    },
    {
      label: t("detail.lastPoll"),
      value: feed.source.updatedAt
        ? formatOsDateTime(feed.source.updatedAt)
        : t("detail.neverPolled"),
    },
    { label: t("detail.pollError"), value: feed.lastError ?? t("detail.emDash") },
  ];
}

export function buildHttpSourceDetailFields(source: HttpSourceInfo): DetailField[] {
  const headerLines =
    Object.keys(source.headers || {}).length > 0
      ? Object.entries(source.headers)
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n")
      : t("detail.headersNone");

  return [
    {
      label: t("detail.name"),
      value: formatSourceLabel(source.source) || source.url,
    },
    ...sourceMetaFields(source.source),
    { label: t("detail.url"), value: source.url, standalone: true },
    { label: t("detail.method"), value: source.method },
    { label: t("detail.auth"), value: source.authType },
    { label: t("detail.headers"), value: headerLines },
    { label: t("detail.bodyType"), value: source.bodyType },
    {
      label: t("detail.pollInterval"),
      value: t("detail.everyMinutes", {
        minutes: Math.round(source.pollIntervalSeconds / 60),
      }),
    },
    { label: t("detail.maxChars"), value: String(source.maxContentChars) },
    {
      label: t("detail.lastSuccess"),
      value: source.lastSuccessAt
        ? formatOsDateTime(source.lastSuccessAt)
        : t("detail.emDash"),
    },
    {
      label: t("detail.lastPoll"),
      value: source.source.updatedAt
        ? formatOsDateTime(source.source.updatedAt)
        : t("detail.neverPolled"),
    },
    {
      label: t("detail.pollError"),
      value: source.lastError ?? t("detail.emDash"),
      standalone: true,
    },
  ];
}

export function buildMqttBrokerDetailFields(broker: MqttBrokerInfo): DetailField[] {
  return [
    { label: t("detail.brokerUrl"), value: broker.brokerUrl, standalone: true },
    ...sourceMetaFields(broker.source),
    {
      label: t("detail.subscribeTopics"),
      value: broker.topics.length > 0 ? broker.topics.join("\n") : t("detail.notSet"),
      standalone: true,
    },
    { label: t("detail.clientId"), value: broker.clientId || t("detail.emDash") },
    {
      label: t("detail.lastSuccess"),
      value: broker.lastSuccessAt
        ? formatOsDateTime(broker.lastSuccessAt)
        : t("detail.emDash"),
    },
    {
      label: t("detail.connectionError"),
      value: broker.lastError ?? t("detail.emDash"),
      standalone: true,
    },
  ];
}

export function buildDiscordBotDetailFields(bot: DiscordBotInfo): DetailField[] {
  const channelsByGuild = bot.channels.reduce<Record<string, string[]>>((acc, ch) => {
    const guild = ch.guildName || "Unknown";
    const group = acc[guild] ?? [];
    group.push(`#${ch.name.split(" / #").pop() || ch.name}`);
    acc[guild] = group;
    return acc;
  }, {});

  const channelLines =
    bot.channels.length > 0
      ? Object.entries(channelsByGuild)
          .map(([guild, names]) => `${guild}\n${names.join("\n")}`)
          .join("\n\n")
      : t("detail.noChannelsYet");

  return [
    {
      label: t("detail.botName"),
      value: formatSourceLabel(bot.source) || t("discord.fallbackName"),
      standalone: true,
    },
    ...sourceMetaFields(bot.source),
    { label: t("detail.channelCount"), value: String(bot.channels.length), standalone: true },
    { label: t("detail.channelList"), value: channelLines, standalone: true },
  ];
}
