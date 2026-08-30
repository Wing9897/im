import type {
  ActionType,
  DiscordWebhookConfig,
  HttpWebhookConfig,
  MqttConfig,
  TelegramBotConfig,
} from "../../types";

/** Form fields needed to build / validate an action `configuration` JSON. */
export interface ActionTypeConfigInput {
  actionType: ActionType | null;
  botToken: string;
  chatId: string;
  discordWebhookUrl: string;
  httpUrl: string;
  httpMethod: "POST" | "PUT";
  httpHeaders: ReadonlyArray<{ key: string; value: string }>;
  httpIncludeRawData: boolean;
  mqttBrokerUrl: string;
  mqttTopic: string;
  mqttUsername: string;
  mqttPassword: string;
  mqttQos: 0 | 1 | 2;
}

export function toTelegramBotConfig(form: ActionTypeConfigInput): TelegramBotConfig {
  return { bot_token: form.botToken.trim(), chat_id: form.chatId.trim() };
}

export function toDiscordWebhookConfig(form: ActionTypeConfigInput): DiscordWebhookConfig {
  return { webhook_url: form.discordWebhookUrl.trim() };
}

export function toHttpWebhookConfig(form: ActionTypeConfigInput): HttpWebhookConfig {
  const headers: Record<string, string> = {};
  for (const entry of form.httpHeaders) {
    const key = entry.key.trim();
    if (key) headers[key] = entry.value.trim();
  }
  return {
    url: form.httpUrl.trim(),
    method: form.httpMethod,
    headers,
    include_raw_data: form.httpIncludeRawData,
  };
}

export function toMqttConfig(form: ActionTypeConfigInput): MqttConfig {
  return {
    broker_url: form.mqttBrokerUrl.trim(),
    topic: form.mqttTopic.trim(),
    username: form.mqttUsername.trim(),
    password: form.mqttPassword.trim(),
    qos: form.mqttQos,
  };
}

export function buildConfiguration(form: ActionTypeConfigInput): string {
  switch (form.actionType) {
    case "telegram_bot":
      return JSON.stringify(toTelegramBotConfig(form));
    case "discord_webhook":
      return JSON.stringify(toDiscordWebhookConfig(form));
    case "http_webhook":
      return JSON.stringify(toHttpWebhookConfig(form));
    case "mqtt":
      return JSON.stringify(toMqttConfig(form));
    default:
      return "{}";
  }
}
