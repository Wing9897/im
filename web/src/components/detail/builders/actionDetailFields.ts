import type {
  Action,
  DiscordWebhookConfig,
  HttpWebhookConfig,
  MqttConfig,
  TelegramBotConfig,
} from "../../../types";
import {
  ACTION_TYPE_LABELS,
  formatTriggerSummary,
} from "../../../domain/actions/actionLabels";
import { formatOptionalOsDateTime, formatOsDateTime } from "../../../utils/time";
import i18n from "../../../i18n";
import type { DetailField } from "../types";

function t(key: string, opts?: Record<string, string | number>): string {
  return String(i18n.t(`actions:detailFields.${key}`, opts));
}

/** Mask sensitive values — show last 4 chars or bullets. */
export function maskSecretValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return String(i18n.t("emDash"));
  if (trimmed.length <= 4) return "••••";
  return `••••${trimmed.slice(-4)}`;
}

/** Mask URL while preserving scheme/host; obfuscates path segments. */
export function maskSensitiveUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return String(i18n.t("emDash"));
  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split("/").filter(Boolean);
    let maskedPath = parsed.pathname;
    if (segments.length > 0) {
      const last = segments[segments.length - 1];
      segments[segments.length - 1] = maskSecretValue(last);
      maskedPath = `/${segments.join("/")}`;
    }
    const maskedPassword = parsed.password ? maskSecretValue(parsed.password) : "";
    const auth =
      parsed.username.length > 0
        ? `${parsed.username}${maskedPassword ? `:${maskedPassword}` : ""}@`
        : "";
    return `${parsed.protocol}//${auth}${parsed.host}${maskedPath}${parsed.search}${parsed.hash}`;
  } catch {
    return maskSecretValue(trimmed);
  }
}

function parseConfiguration(action: Action): Record<string, unknown> {
  try {
    return JSON.parse(action.configuration) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function buildConfigFields(action: Action): DetailField[] {
  const config: unknown = parseConfiguration(action);
  const dash = String(i18n.t("emDash"));

  switch (action.actionType) {
    case "telegram_bot": {
      const cfg = config as TelegramBotConfig;
      return [
        { label: "Bot Token", value: maskSecretValue(String(cfg.bot_token ?? "")), standalone: true },
        { label: "Chat ID", value: String(cfg.chat_id ?? dash), standalone: true },
      ];
    }
    case "discord_webhook": {
      const cfg = config as DiscordWebhookConfig;
      return [{ label: "Webhook URL", value: maskSensitiveUrl(String(cfg.webhook_url ?? "")), standalone: true }];
    }
    case "http_webhook": {
      const cfg = config as HttpWebhookConfig;
      const headerLines =
        cfg.headers && Object.keys(cfg.headers).length > 0
          ? Object.entries(cfg.headers)
              .map(([key, val]) => `${key}: ${maskSecretValue(String(val))}`)
              .join("\n")
          : dash;
      return [
        { label: "URL", value: maskSensitiveUrl(String(cfg.url ?? "")), standalone: true },
        { label: "Method", value: String(cfg.method ?? "POST"), standalone: true },
        { label: "Headers", value: headerLines, standalone: true },
        {
          label: t("includeRawData"),
          value: cfg.include_raw_data ? t("yes") : t("no"),
          standalone: true,
        },
      ];
    }
    case "mqtt": {
      const cfg = config as MqttConfig;
      return [
        { label: "Broker URL", value: maskSensitiveUrl(String(cfg.broker_url ?? "")), standalone: true },
        { label: "Topic", value: String(cfg.topic ?? dash), standalone: true },
        { label: "Username", value: cfg.username ? maskSecretValue(cfg.username) : dash, standalone: true },
        { label: "Password", value: cfg.password ? maskSecretValue(cfg.password) : dash, standalone: true },
        { label: "QoS", value: String(cfg.qos ?? 0), standalone: true },
      ];
    }
    default:
      return [];
  }
}

export function buildActionDetailFields(action: Action): DetailField[] {
  return [
    { label: t("type"), value: ACTION_TYPE_LABELS[action.actionType] ?? action.actionType },
    {
      label: t("trigger"),
      value: formatTriggerSummary(action, (key, options) => t(key, options as Record<string, string | number>)),
    },
    { label: t("enabledStatus"), value: action.isEnabled ? t("enabled") : t("disabled") },
    {
      label: t("lastTriggered"),
      value: formatOptionalOsDateTime(action.lastTriggeredAt, undefined, t("never")),
    },
    { label: t("createdAt"), value: formatOsDateTime(action.createdAt) },
    { label: t("updatedAt"), value: formatOsDateTime(action.updatedAt) },
    ...buildConfigFields(action),
  ];
}
