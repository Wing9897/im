import type {
  Action,
  DiscordWebhookConfig,
  HttpWebhookConfig,
  MqttConfig,
  TelegramBotConfig,
} from "../../types";
import { parseTriggerConditions } from "../../domain/actions/parseTriggerConditions";
import type { ActionFormState } from "./form/useActionFormDialog";

function parseConfig(configJson: string): Record<string, unknown> {
  try {
    return JSON.parse(configJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function asTelegramConfig(config: Record<string, unknown>): TelegramBotConfig {
  return {
    bot_token: typeof config.bot_token === "string" ? config.bot_token : "",
    chat_id: typeof config.chat_id === "string" ? config.chat_id : "",
  };
}

function asDiscordConfig(config: Record<string, unknown>): DiscordWebhookConfig {
  return { webhook_url: typeof config.webhook_url === "string" ? config.webhook_url : "" };
}

function asHttpConfig(config: Record<string, unknown>): HttpWebhookConfig {
  const headers = config.headers != null && typeof config.headers === "object" && !Array.isArray(config.headers)
    ? (config.headers as Record<string, string>)
    : {};
  return {
    url: typeof config.url === "string" ? config.url : "",
    method: config.method === "PUT" ? "PUT" : "POST",
    headers,
    include_raw_data: typeof config.include_raw_data === "boolean" ? config.include_raw_data : false,
  };
}

function asMqttConfig(config: Record<string, unknown>): MqttConfig {
  const qos = typeof config.qos === "number" && [0, 1, 2].includes(config.qos)
    ? (config.qos as 0 | 1 | 2)
    : 0;
  return {
    broker_url: typeof config.broker_url === "string" ? config.broker_url : "",
    topic: typeof config.topic === "string" ? config.topic : "",
    username: typeof config.username === "string" ? config.username : "",
    password: typeof config.password === "string" ? config.password : "",
    qos,
  };
}

export function formStateFromAction(
  action: Action,
  emptyFormState: ActionFormState,
  nextHeaderId: () => string,
): ActionFormState {
  const config = parseConfig(action.configuration);
  const tc = parseTriggerConditions(action.triggerConditions);
  const base: ActionFormState = {
    ...emptyFormState,
    name: action.name,
    actionType: action.actionType,
    scoreThreshold: tc.score_threshold != null ? String(tc.score_threshold) : "",
    taskId: tc.task_id ?? "",
  };

  switch (action.actionType) {
    case "telegram_bot": {
      const config = asTelegramConfig(parseConfig(action.configuration));
      base.botToken = config.bot_token;
      base.chatId = config.chat_id;
      break;
    }
    case "discord_webhook":
      base.discordWebhookUrl = asDiscordConfig(config).webhook_url;
      break;
    case "http_webhook": {
      const config = asHttpConfig(parseConfig(action.configuration));
      base.httpUrl = config.url;
      base.httpMethod = config.method;
      const entries = Object.entries(config.headers).map(([key, value]) => ({ id: nextHeaderId(), key, value }));
      base.httpHeaders = entries.length > 0 ? entries : [{ id: nextHeaderId(), key: "", value: "" }];
      base.httpIncludeRawData = config.include_raw_data;
      break;
    }
    case "mqtt": {
      const config = asMqttConfig(parseConfig(action.configuration));
      base.mqttBrokerUrl = config.broker_url;
      base.mqttTopic = config.topic;
      base.mqttUsername = config.username;
      base.mqttPassword = config.password;
      base.mqttQos = config.qos;
      break;
    }
  }
  return base;
}
