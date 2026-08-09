import { describe, it, expect } from "vitest";
import { formStateFromAction, buildConfiguration, applyActionTypeSwitch } from "./useActionTypeHandlers";
import { emptyFormState } from "../form/useActionFormDialog";
import type { Action, ActionType } from "../../../types";

function makeAction(overrides: Partial<Action>): Action {
  return {
    id: "a1",
    name: "Test Action",
    actionType: "telegram_bot",
    configuration: "{}",
    triggerConditions: null,
    isEnabled: true,
    lastTriggeredAt: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("formStateFromAction - type-safe config parsing", () => {
  it("parses valid telegram_bot config", () => {
    const action = makeAction({
      actionType: "telegram_bot",
      configuration: JSON.stringify({ bot_token: "123:ABC", chat_id: "-100123" }),
    });
    const state = formStateFromAction(action, emptyFormState);
    expect(state.botToken).toBe("123:ABC");
    expect(state.chatId).toBe("-100123");
  });

  it("handles missing fields in telegram_bot config gracefully", () => {
    const action = makeAction({
      actionType: "telegram_bot",
      configuration: JSON.stringify({}),
    });
    const state = formStateFromAction(action, emptyFormState);
    expect(state.botToken).toBe("");
    expect(state.chatId).toBe("");
  });

  it("handles non-string fields in telegram_bot config gracefully", () => {
    const action = makeAction({
      actionType: "telegram_bot",
      configuration: JSON.stringify({ bot_token: 12345, chat_id: null }),
    });
    const state = formStateFromAction(action, emptyFormState);
    expect(state.botToken).toBe("");
    expect(state.chatId).toBe("");
  });

  it("parses valid discord_webhook config", () => {
    const action = makeAction({
      actionType: "discord_webhook",
      configuration: JSON.stringify({ webhook_url: "https://discord.com/api/webhooks/123/abc" }),
    });
    const state = formStateFromAction(action, emptyFormState);
    expect(state.discordWebhookUrl).toBe("https://discord.com/api/webhooks/123/abc");
  });

  it("parses valid http_webhook config with headers", () => {
    const action = makeAction({
      actionType: "http_webhook",
      configuration: JSON.stringify({
        url: "https://example.com/hook",
        method: "PUT",
        headers: { "X-Token": "secret" },
        include_raw_data: true,
      }),
    });
    const state = formStateFromAction(action, emptyFormState);
    expect(state.httpUrl).toBe("https://example.com/hook");
    expect(state.httpMethod).toBe("PUT");
    expect(state.httpHeaders).toHaveLength(1);
    expect(state.httpHeaders[0].key).toBe("X-Token");
    expect(state.httpHeaders[0].value).toBe("secret");
    expect(state.httpIncludeRawData).toBe(true);
  });

  it("defaults http_webhook method to POST for invalid values", () => {
    const action = makeAction({
      actionType: "http_webhook",
      configuration: JSON.stringify({ url: "https://x.com", method: "DELETE" }),
    });
    const state = formStateFromAction(action, emptyFormState);
    expect(state.httpMethod).toBe("POST");
  });

  it("parses valid mqtt config", () => {
    const action = makeAction({
      actionType: "mqtt",
      configuration: JSON.stringify({
        broker_url: "mqtt://broker.local",
        topic: "alerts/high",
        username: "user",
        password: "pass",
        qos: 2,
      }),
    });
    const state = formStateFromAction(action, emptyFormState);
    expect(state.mqttBrokerUrl).toBe("mqtt://broker.local");
    expect(state.mqttTopic).toBe("alerts/high");
    expect(state.mqttUsername).toBe("user");
    expect(state.mqttPassword).toBe("pass");
    expect(state.mqttQos).toBe(2);
  });

  it("defaults mqtt qos to 0 for invalid values", () => {
    const action = makeAction({
      actionType: "mqtt",
      configuration: JSON.stringify({ broker_url: "mqtt://x", topic: "t", username: "", password: "", qos: 5 }),
    });
    const state = formStateFromAction(action, emptyFormState);
    expect(state.mqttQos).toBe(0);
  });

  it("handles malformed JSON configuration gracefully", () => {
    const action = makeAction({
      actionType: "telegram_bot",
      configuration: "not-json{{{",
    });
    const state = formStateFromAction(action, emptyFormState);
    expect(state.botToken).toBe("");
    expect(state.chatId).toBe("");
  });
});

describe("buildConfiguration", () => {
  it("builds telegram_bot config JSON", () => {
    const form = { ...emptyFormState, actionType: "telegram_bot" as const, botToken: " abc ", chatId: " 123 " };
    const json = JSON.parse(buildConfiguration(form));
    expect(json.bot_token).toBe("abc");
    expect(json.chat_id).toBe("123");
  });

  it("builds http_webhook config with headers", () => {
    const form = {
      ...emptyFormState,
      actionType: "http_webhook" as const,
      httpUrl: "https://x.com/hook",
      httpMethod: "PUT" as const,
      httpHeaders: [
        { id: "h1", key: "Auth", value: "Bearer tok" },
        { id: "h2", key: "", value: "ignored" },
      ],
      httpIncludeRawData: true,
    };
    const json = JSON.parse(buildConfiguration(form));
    expect(json.url).toBe("https://x.com/hook");
    expect(json.method).toBe("PUT");
    expect(json.headers).toEqual({ Auth: "Bearer tok" });
    expect(json.include_raw_data).toBe(true);
  });
});

describe("applyActionTypeSwitch", () => {
  function makeFilledForm(actionType: ActionType) {
    const base = {
      ...emptyFormState,
      name: "Alert Rule",
      scoreThreshold: "80",
      taskId: "task-abc",
      actionType,
    };
    switch (actionType) {
      case "telegram_bot":
        return { ...base, botToken: "token", chatId: "chat-1" };
      case "discord_webhook":
        return { ...base, discordWebhookUrl: "https://discord.com/hook" };
      case "http_webhook":
        return {
          ...base,
          httpUrl: "https://example.com/hook",
          httpMethod: "PUT" as const,
          httpHeaders: [{ id: "h1", key: "Auth", value: "secret" }],
          httpIncludeRawData: true,
        };
      case "mqtt":
        return {
          ...base,
          mqttBrokerUrl: "mqtt://broker",
          mqttTopic: "alerts",
          mqttUsername: "user",
          mqttPassword: "pass",
          mqttQos: 2 as const,
        };
    }
  }

  const typePairs: [ActionType, ActionType][] = [
    ["telegram_bot", "discord_webhook"],
    ["discord_webhook", "http_webhook"],
    ["http_webhook", "mqtt"],
    ["mqtt", "telegram_bot"],
  ];

  it("preserves common fields and resets ActionType-specific fields on switch", () => {
    for (const [typeA, typeB] of typePairs) {
      const formBefore = makeFilledForm(typeA);
      const formAfter = applyActionTypeSwitch(formBefore, typeB);

      expect(formAfter.name).toBe(formBefore.name);
      expect(formAfter.scoreThreshold).toBe(formBefore.scoreThreshold);
      expect(formAfter.taskId).toBe(formBefore.taskId);
      expect(formAfter.actionType).toBe(typeB);

      expect(formAfter.botToken).toBe("");
      expect(formAfter.chatId).toBe("");
      expect(formAfter.discordWebhookUrl).toBe("");
      expect(formAfter.httpUrl).toBe("");
      expect(formAfter.httpMethod).toBe("POST");
      expect(formAfter.httpHeaders).toHaveLength(1);
      expect(formAfter.httpHeaders[0].key).toBe("");
      expect(formAfter.httpHeaders[0].value).toBe("");
      expect(formAfter.httpIncludeRawData).toBe(false);
      expect(formAfter.mqttBrokerUrl).toBe("");
      expect(formAfter.mqttTopic).toBe("");
      expect(formAfter.mqttUsername).toBe("");
      expect(formAfter.mqttPassword).toBe("");
      expect(formAfter.mqttQos).toBe(0);
    }
  });
});
