import { describe, expect, it } from "vitest";
import {
  buildActionDetailFields,
  maskSecretValue,
  maskSensitiveUrl,
} from "./actionDetailFields";
import type { Action } from "../../types";

const baseAction: Action = {
  id: "a1",
  name: "Test",
  actionType: "telegram_bot",
  configuration: JSON.stringify({ bot_token: "1234567890:ABCDEFghij", chat_id: "-100" }),
  triggerConditions: JSON.stringify({ score_threshold: 80 }),
  isEnabled: true,
  lastTriggeredAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("maskSecretValue", () => {
  it("masks values longer than 4 chars", () => {
    expect(maskSecretValue("1234567890")).toBe("••••7890");
  });

  it("returns bullets for short values", () => {
    expect(maskSecretValue("abc")).toBe("••••");
  });
});

describe("maskSensitiveUrl", () => {
  it("obfuscates the last path segment", () => {
    const masked = maskSensitiveUrl("https://discord.com/api/webhooks/123/secret-token");
    expect(masked).toContain("••••");
    expect(masked).not.toContain("secret-token");
  });
});

describe("buildActionDetailFields", () => {
  it("masks bot token in detail fields", () => {
    const fields = buildActionDetailFields(baseAction);
    const tokenField = fields.find((f) => f.label === "Bot Token");
    expect(tokenField?.value).toBe("••••ghij");
    expect(tokenField?.value).not.toContain("1234567890");
  });

  it("masks discord webhook url", () => {
    const action: Action = {
      ...baseAction,
      actionType: "discord_webhook",
      configuration: JSON.stringify({
        webhook_url: "https://discord.com/api/webhooks/99/my-secret-webhook",
      }),
    };
    const fields = buildActionDetailFields(action);
    const urlField = fields.find((f) => f.label === "Webhook URL");
    expect(urlField?.value).toContain("••••");
    expect(urlField?.value).not.toContain("my-secret-webhook");
  });
});
