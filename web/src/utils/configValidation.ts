// ============================================================
// Frontend Configuration Validation
// ============================================================

import type { ValidationResult } from "../types";
import i18n from "../i18n";
import { isSafeHttpUrl } from "./safeUrl";

/** Shorthand for looking up `common:validation.*` keys with interpolation. */
function tv(key: string, options?: Record<string, unknown>): string {
  return i18n.t(`common:validation.${key}`, options);
}

export const MASKED_SECRET = "********";

const DISCORD_PREFIXES = [
  "https://discord.com/api/webhooks/",
  "https://discordapp.com/api/webhooks/",
] as const;

// Maximum allowed URL length for webhook/broker configuration inputs.
const MAX_URL_LENGTH = 2048;

// ── Discord Webhook Validation ────────────────────────

/** Validates a Discord webhook configuration object. */
export function validateDiscordConfig(config: {
  webhook_url: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!config.webhook_url || config.webhook_url.trim() === "") {
    errors.webhook_url = tv("webhookUrlRequired");
  } else if (config.webhook_url === MASKED_SECRET) {
    return { valid: true, errors };
  } else if (
    !DISCORD_PREFIXES.some((prefix) => config.webhook_url.startsWith(prefix))
  ) {
    errors.webhook_url = tv("webhookUrlPrefix", {
      prefixes: DISCORD_PREFIXES.join(tv("orSeparator")),
    });
  } else if (config.webhook_url.length > MAX_URL_LENGTH) {
    errors.webhook_url = tv("webhookUrlMaxLength", { max: MAX_URL_LENGTH });
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ── HTTP Webhook Validation ───────────────────────────

/** Validates an HTTP webhook configuration (URL format and method). */
export function validateHttpConfig(config: {
  url: string;
  method: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!config.url || config.url.trim() === "") {
    errors.url = tv("urlRequired");
  } else if (config.url === MASKED_SECRET) {
    // Existing webhook URLs are masked by the API and preserved on update.
  } else if (
    !config.url.startsWith("http://") &&
    !config.url.startsWith("https://")
  ) {
    errors.url = tv("urlPrefix");
  } else if (!isSafeHttpUrl(config.url)) {
    errors.url = tv("urlUnsafeProtocol");
  } else if (config.url.length > MAX_URL_LENGTH) {
    errors.url = tv("urlMaxLength", { max: MAX_URL_LENGTH });
  }

  if (config.method !== "POST" && config.method !== "PUT") {
    errors.method = tv("httpMethodInvalid");
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ── MQTT Validation ───────────────────────────────────

const MAX_MQTT_TOPIC_LENGTH = 256;

/** Returns the first broker URL validation error, or null when valid. */
export function validateMqttBrokerUrl(brokerUrl: string): string | null {
  const url = brokerUrl.trim();
  if (!url) return tv("brokerUrlRequired");
  if (!url.startsWith("mqtt://") && !url.startsWith("mqtts://")) {
    return tv("brokerUrlPrefix");
  }
  if (url.length > MAX_URL_LENGTH) {
    return tv("brokerUrlMaxLength", { max: MAX_URL_LENGTH });
  }
  return null;
}

/** Returns the first topic-list validation error, or null when valid. */
export function validateMqttTopicList(topics: string[]): string | null {
  const validTopics = topics.filter((topic) => topic.trim().length > 0);
  if (validTopics.length === 0) return tv("topicRequired");
  for (const topic of validTopics) {
    if (topic.trim().length > MAX_MQTT_TOPIC_LENGTH) {
      return tv("topicMaxLength", { max: MAX_MQTT_TOPIC_LENGTH });
    }
  }
  return null;
}

/** Validates an MQTT broker configuration (URL, topic, QoS, and credential pair). */
export function validateMqttConfig(config: {
  broker_url: string;
  topic: string;
  username: string;
  password: string;
  qos: number;
}): ValidationResult {
  const errors: Record<string, string> = {};

  const brokerError = validateMqttBrokerUrl(config.broker_url);
  if (brokerError) errors.broker_url = brokerError;

  const topicError = validateMqttTopicList([config.topic]);
  if (topicError) errors.topic = topicError;

  if (config.qos !== 0 && config.qos !== 1 && config.qos !== 2) {
    errors.qos = tv("qosInvalid");
  }

  // Credential pair logic: both or neither
  const hasUsername = config.username != null && config.username.trim() !== "";
  const hasPassword = config.password != null && config.password.trim() !== "";
  if (hasUsername !== hasPassword) {
    errors.username = tv("credentialPairRequired");
    errors.password = tv("credentialPairRequired");
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ── Telegram Validation ───────────────────────────────

/** Validates a Telegram bot configuration (bot token and chat ID presence). */
export function validateTelegramConfig(config: {
  bot_token: string;
  chat_id: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!config.bot_token || config.bot_token.trim() === "") {
    errors.bot_token = tv("botTokenRequired");
  }

  if (!config.chat_id || config.chat_id.trim() === "") {
    errors.chat_id = tv("chatIdRequired");
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ── Email IMAP Validation ─────────────────────────────

const MIN_POLL_INTERVAL_SECONDS = 60;
const MAX_POLL_INTERVAL_SECONDS = 86400;

/** Returns the first IMAP host validation error, or null when valid. */
function validateEmailImapHost(host: string): string | null {
  const trimmed = host.trim();
  if (!trimmed) return tv("imapHostRequired");
  if (trimmed.includes("://")) return tv("imapHostNoProtocol");
  if (trimmed.length > 253) return tv("imapHostTooLong");
  return null;
}

/** Returns the first poll interval validation error, or null when valid. */
function validateEmailPollIntervalSeconds(seconds: number): string | null {
  if (!Number.isFinite(seconds)) return tv("pollIntervalNumber");
  if (seconds < MIN_POLL_INTERVAL_SECONDS || seconds > MAX_POLL_INTERVAL_SECONDS) {
    return tv("pollIntervalRange", {
      min: MIN_POLL_INTERVAL_SECONDS,
      max: MAX_POLL_INTERVAL_SECONDS,
    });
  }
  return null;
}

/** Returns the first folder list validation error, or null when valid. */
function validateEmailFolderList(folders: string[]): string | null {
  const valid = folders.map((f) => f.trim()).filter((f) => f.length > 0);
  if (valid.length === 0) return tv("folderRequired");
  return null;
}

/** Validates an email IMAP source configuration for add/edit forms. */
export function validateEmailImapConfig(config: {
  imap_host: string;
  imap_port: number;
  username: string;
  password: string;
  folders: string[];
  poll_interval_seconds: number;
  initial_sync_days?: number;
  initial_sync_max_messages?: number;
  is_edit?: boolean;
}): ValidationResult {
  const errors: Record<string, string> = {};

  const hostError = validateEmailImapHost(config.imap_host);
  if (hostError) errors.imap_host = hostError;

  if (!Number.isFinite(config.imap_port) || config.imap_port < 1 || config.imap_port > 65535) {
    errors.imap_port = tv("imapPortRange");
  }

  if (!config.username?.trim()) {
    errors.username = tv("emailRequired");
  }

  const password = config.password?.trim() ?? "";
  const passwordOptional = config.is_edit && password === MASKED_SECRET;
  if (!passwordOptional && !password) {
    errors.password = tv("appPasswordRequired");
  }

  const folderError = validateEmailFolderList(config.folders);
  if (folderError) errors.folders = folderError;

  const intervalError = validateEmailPollIntervalSeconds(config.poll_interval_seconds);
  if (intervalError) errors.poll_interval_seconds = intervalError;

  if (config.initial_sync_days !== undefined) {
    if (!Number.isFinite(config.initial_sync_days) || config.initial_sync_days < 1 || config.initial_sync_days > 365) {
      errors.initial_sync_days = tv("initialSyncDaysRange", { min: 1, max: 365 });
    }
  }

  if (config.initial_sync_max_messages !== undefined) {
    if (
      !Number.isFinite(config.initial_sync_max_messages) ||
      config.initial_sync_max_messages < 1 ||
      config.initial_sync_max_messages > 10_000
    ) {
      errors.initial_sync_max_messages = tv("initialSyncMaxMessagesRange", {
        min: 1,
        max: 10_000,
      });
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
