/**
 * Guard: action configuration JSON keys / validation error keys stay aligned
 * with generated OpenAPI models (TelegramBotConfig, …).
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type {
  DiscordWebhookConfig,
  HttpWebhookConfig,
  MqttConfig,
  TelegramBotConfig,
} from "../../types";
import {
  buildConfiguration,
  toDiscordWebhookConfig,
  toHttpWebhookConfig,
  toMqttConfig,
  toTelegramBotConfig,
  type ActionTypeConfigInput,
} from "./actionConfiguration";
import { validateActionTypeFields } from "./validateActionTypeFields";

const SCHEMA_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../api/generated/schema.d.ts",
);

function openApiSchemaKeys(schemaName: string): string[] {
  const source = readFileSync(SCHEMA_PATH, "utf8");
  const block = source.match(new RegExp(`${schemaName}: \\{([\\s\\S]*?)\\n        \\};`));
  if (!block) {
    throw new Error(`${schemaName} not found in schema.d.ts`);
  }
  return [...block[1].matchAll(/^\s+(\w+)\??:/gm)].map((match) => match[1]).sort();
}

function keysOf<T extends object>(sample: T): string[] {
  return Object.keys(sample).sort();
}

const emptyInput: ActionTypeConfigInput = {
  actionType: null,
  botToken: "",
  chatId: "",
  discordWebhookUrl: "",
  httpUrl: "",
  httpMethod: "POST",
  httpHeaders: [],
  httpIncludeRawData: false,
  mqttBrokerUrl: "",
  mqttTopic: "",
  mqttUsername: "",
  mqttPassword: "",
  mqttQos: 0,
};

const telegramSample = {
  bot_token: "123:ABC",
  chat_id: "-100123",
} satisfies TelegramBotConfig;

const discordSample = {
  webhook_url: "https://discord.com/api/webhooks/1/abc",
} satisfies DiscordWebhookConfig;

const httpSample = {
  url: "https://example.com/hook",
  method: "PUT",
  headers: { Auth: "tok" },
  include_raw_data: true,
} satisfies HttpWebhookConfig;

const mqttSample = {
  broker_url: "mqtt://broker.local",
  topic: "alerts/high",
  username: "user",
  password: "pass",
  qos: 2,
} satisfies MqttConfig;

describe("action configuration OpenAPI drift", () => {
  it("TelegramBotConfig keys match generated OpenAPI", () => {
    expect(keysOf(telegramSample)).toEqual(openApiSchemaKeys("TelegramBotConfig"));
  });

  it("DiscordWebhookConfig keys match generated OpenAPI", () => {
    expect(keysOf(discordSample)).toEqual(openApiSchemaKeys("DiscordWebhookConfig"));
  });

  it("HttpWebhookConfig keys match generated OpenAPI", () => {
    expect(keysOf(httpSample)).toEqual(openApiSchemaKeys("HttpWebhookConfig"));
  });

  it("MqttConfig keys match generated OpenAPI", () => {
    expect(keysOf(mqttSample)).toEqual(openApiSchemaKeys("MqttConfig"));
  });

  it("buildConfiguration telegram_bot emits TelegramBotConfig keys", () => {
    const form: ActionTypeConfigInput = {
      ...emptyInput,
      actionType: "telegram_bot",
      botToken: telegramSample.bot_token,
      chatId: telegramSample.chat_id,
    };
    const parsed: TelegramBotConfig = JSON.parse(buildConfiguration(form));
    expect(parsed).toEqual(telegramSample);
    expect(toTelegramBotConfig(form)).toEqual(telegramSample);
    expect(keysOf(parsed)).toEqual(openApiSchemaKeys("TelegramBotConfig"));
  });

  it("buildConfiguration discord_webhook emits DiscordWebhookConfig keys", () => {
    const form: ActionTypeConfigInput = {
      ...emptyInput,
      actionType: "discord_webhook",
      discordWebhookUrl: discordSample.webhook_url,
    };
    const parsed: DiscordWebhookConfig = JSON.parse(buildConfiguration(form));
    expect(parsed).toEqual(discordSample);
    expect(toDiscordWebhookConfig(form)).toEqual(discordSample);
    expect(keysOf(parsed)).toEqual(openApiSchemaKeys("DiscordWebhookConfig"));
  });

  it("buildConfiguration http_webhook emits HttpWebhookConfig keys", () => {
    const form: ActionTypeConfigInput = {
      ...emptyInput,
      actionType: "http_webhook",
      httpUrl: httpSample.url,
      httpMethod: httpSample.method,
      httpHeaders: [{ key: "Auth", value: "tok" }],
      httpIncludeRawData: httpSample.include_raw_data,
    };
    const parsed: HttpWebhookConfig = JSON.parse(buildConfiguration(form));
    expect(parsed).toEqual(httpSample);
    expect(toHttpWebhookConfig(form)).toEqual(httpSample);
    expect(keysOf(parsed)).toEqual(openApiSchemaKeys("HttpWebhookConfig"));
  });

  it("buildConfiguration mqtt emits MqttConfig keys", () => {
    const form: ActionTypeConfigInput = {
      ...emptyInput,
      actionType: "mqtt",
      mqttBrokerUrl: mqttSample.broker_url,
      mqttTopic: mqttSample.topic,
      mqttUsername: mqttSample.username,
      mqttPassword: mqttSample.password,
      mqttQos: mqttSample.qos,
    };
    const parsed: MqttConfig = JSON.parse(buildConfiguration(form));
    expect(parsed).toEqual(mqttSample);
    expect(toMqttConfig(form)).toEqual(mqttSample);
    expect(keysOf(parsed)).toEqual(openApiSchemaKeys("MqttConfig"));
  });

  it("validation error keys are a subset of the matching OpenAPI config keys", () => {
    const cases: Array<{
      form: ActionTypeConfigInput;
      openApiName: string;
    }> = [
      { form: { ...emptyInput, actionType: "telegram_bot" }, openApiName: "TelegramBotConfig" },
      { form: { ...emptyInput, actionType: "discord_webhook" }, openApiName: "DiscordWebhookConfig" },
      { form: { ...emptyInput, actionType: "http_webhook" }, openApiName: "HttpWebhookConfig" },
      {
        form: { ...emptyInput, actionType: "mqtt", mqttUsername: "only-user" },
        openApiName: "MqttConfig",
      },
    ];

    for (const { form, openApiName } of cases) {
      const allowed = new Set(openApiSchemaKeys(openApiName));
      const result = validateActionTypeFields(form);
      expect(result.valid, openApiName).toBe(false);
      for (const key of Object.keys(result.errors)) {
        expect(allowed.has(key), `${openApiName} unexpected error key ${key}`).toBe(true);
      }
    }
  });
});
