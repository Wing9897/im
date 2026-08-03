/**
 * Unit tests for ActionTypeFields.
 *
 * Coverage for conditional rendering and routing. ActionTypeFields is a
 * router that renders different field sections based on form.actionType.
 *
 * Covers: null, unknown type, and each of the four supported action types
 * (telegram_bot, discord_webhook, http_webhook, mqtt).
 */
import { describe, it, expect } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { ActionTypeFields } from "./ActionTypeFields";
import type { ActionFormState, HeaderEntry } from "./form/useActionFormDialog";
import { emptyFormState } from "./form/useActionFormDialog";

function makeForm(overrides: Partial<ActionFormState> = {}): ActionFormState {
  return { ...emptyFormState, ...overrides };
}

function render(form: ActionFormState) {
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(
      createElement(ActionTypeFields, {
        form,
        fieldErrors: {} as Record<string, string>,
        submitting: false,
        onChange: (() => {}) as (
          field: keyof ActionFormState,
          value: string | boolean | number | HeaderEntry[],
        ) => void,
      }),
    );
  });
  return container;
}

describe("ActionTypeFields", () => {
  it("renders nothing when actionType is null", () => {
    const container = render(makeForm({ actionType: null }));
    expect(container.children.length).toBe(0);
    expect(container.textContent).toBe("");
  });

  it("renders Telegram fields (Bot Token + Chat ID) for telegram_bot", () => {
    const container = render(
      makeForm({ actionType: "telegram_bot", botToken: "abc", chatId: "123" }),
    );
    expect(container.textContent).toContain("Bot Token");
    expect(container.textContent).toContain("Chat ID");
    const inputs = container.querySelectorAll<HTMLInputElement>("input[type='text']");
    expect(inputs.length).toBe(2);
    expect(inputs[0].value).toBe("abc");
    expect(inputs[1].value).toBe("123");
  });

  it("renders Discord webhook URL field for discord_webhook", () => {
    const container = render(
      makeForm({
        actionType: "discord_webhook",
        discordWebhookUrl: "https://discord.com/api/webhooks/x",
      }),
    );
    expect(container.textContent).toContain("Webhook URL");
    const input = container.querySelector<HTMLInputElement>("input[type='text']")!;
    expect(input.value).toBe("https://discord.com/api/webhooks/x");
  });

  it("renders HTTP fields (URL + Method) for http_webhook", () => {
    const container = render(
      makeForm({ actionType: "http_webhook", httpUrl: "https://example.com" }),
    );
    expect(container.textContent).toContain("URL");
    expect(container.textContent).toContain("HTTP Method");
    const urlInput = container.querySelector<HTMLInputElement>("input[type='text']")!;
    expect(urlInput.value).toBe("https://example.com");
  });

  it("renders MQTT-specific fields for mqtt action type", () => {
    const container = render(
      makeForm({
        actionType: "mqtt",
        mqttBrokerUrl: "mqtt://broker:1883",
        mqttTopic: "alerts",
      }),
    );
    // Spot-check a couple of MQTT-specific labels exist
    const text = container.textContent ?? "";
    const matches = /broker|MQTT|Topic|topic|主題/i.test(text);
    expect(matches).toBe(true);
    // mqttBrokerUrl should be present somewhere as an input value
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>("input"));
    const found = inputs.some((i) => i.value === "mqtt://broker:1883");
    expect(found).toBe(true);
  });

  it("returns null for unknown action types", () => {
    // Cast through unknown to bypass strict typing — simulating bad data shape
    const container = render(
      makeForm({ actionType: "non_existent" as unknown as ActionFormState["actionType"] }),
    );
    expect(container.children.length).toBe(0);
  });
});

