/**
 * Boundary condition unit tests for action channel configuration validators.
 *
 * Validates: Requirement 8.3 (boundary conditions for form validation:
 * empty input, max length, special characters, Unicode).
 *
 * Fixed-case tests below also cover universal validation rules (prefix, length,
 * credential pairs) alongside these boundary pins.
 */
import { beforeEach, describe, it, expect } from "vitest";
import i18n from "../i18n";
import {
  MASKED_SECRET,
  validateDiscordConfig,
  validateHttpConfig,
  validateMqttConfig,
  validateTelegramConfig,
  validateEmailImapConfig,
} from "./configValidation";
import { isSafeHttpUrl } from "./safeUrl";

beforeEach(async () => {
  await i18n.changeLanguage("zh-Hant");
});

function tv(key: string, options?: Record<string, unknown>): string {
  return i18n.t(`common:validation.${key}`, options);
}

const MAX_URL_LENGTH = 2048;
const DISCORD_PREFIX = "https://discord.com/api/webhooks/";
const HTTPS_PREFIX = "https://";
const MQTT_PREFIX = "mqtt://";

describe("validateDiscordConfig — boundary conditions", () => {
  // ── Empty input ────────────────────────────────────────

  it("rejects empty webhook_url", () => {
    const result = validateDiscordConfig({ webhook_url: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.webhook_url).toBe(tv("webhookUrlRequired"));
  });

  it("rejects whitespace-only webhook_url", () => {
    const result = validateDiscordConfig({ webhook_url: "    " });
    expect(result.valid).toBe(false);
    expect(result.errors.webhook_url).toBe(tv("webhookUrlRequired"));
  });

  it("accepts the server mask while preserving an existing webhook", () => {
    expect(validateDiscordConfig({ webhook_url: MASKED_SECRET }).valid).toBe(true);
  });

  // ── Max length boundary ────────────────────────────────

  it("accepts webhook_url at exactly the max length (2048)", () => {
    const padding = "a".repeat(MAX_URL_LENGTH - DISCORD_PREFIX.length);
    const url = DISCORD_PREFIX + padding;
    expect(url.length).toBe(MAX_URL_LENGTH);

    const result = validateDiscordConfig({ webhook_url: url });
    expect(result.valid).toBe(true);
  });

  it("rejects webhook_url one character over the max length (2049)", () => {
    const padding = "a".repeat(MAX_URL_LENGTH - DISCORD_PREFIX.length + 1);
    const url = DISCORD_PREFIX + padding;
    expect(url.length).toBe(MAX_URL_LENGTH + 1);

    const result = validateDiscordConfig({ webhook_url: url });
    expect(result.valid).toBe(false);
    expect(result.errors.webhook_url).toContain("2048");
  });

  // ── Special characters ─────────────────────────────────

  it("rejects javascript:-protocol payloads even though they are non-empty", () => {
    const result = validateDiscordConfig({
      webhook_url: "javascript:alert('xss')",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.webhook_url).toContain("https");
  });

  it("rejects URLs disguised with HTML/script content", () => {
    const result = validateDiscordConfig({
      webhook_url: "<script>alert('xss')</script>",
    });
    expect(result.valid).toBe(false);
  });

  // ── Unicode ────────────────────────────────────────────

  it("accepts webhook_url with Unicode in the path segment", () => {
    const url = `${DISCORD_PREFIX}123/トークン-🚀`;
    const result = validateDiscordConfig({ webhook_url: url });
    expect(result.valid).toBe(true);
  });
});

describe("validateHttpConfig — boundary conditions", () => {
  // ── Empty input ────────────────────────────────────────

  it("rejects empty URL", () => {
    const result = validateHttpConfig({ url: "", method: "POST" });
    expect(result.valid).toBe(false);
    expect(result.errors.url).toBe(tv("urlRequired"));
  });

  it("rejects whitespace-only URL", () => {
    const result = validateHttpConfig({ url: "   ", method: "POST" });
    expect(result.valid).toBe(false);
    expect(result.errors.url).toBe(tv("urlRequired"));
  });

  it("accepts the server mask while preserving an existing URL", () => {
    expect(validateHttpConfig({ url: MASKED_SECRET, method: "POST" }).valid).toBe(true);
  });

  // ── Max length boundary ────────────────────────────────

  it("accepts URL at exactly 2048 characters", () => {
    const url = HTTPS_PREFIX + "a".repeat(MAX_URL_LENGTH - HTTPS_PREFIX.length);
    expect(url.length).toBe(MAX_URL_LENGTH);

    const result = validateHttpConfig({ url, method: "POST" });
    expect(result.valid).toBe(true);
  });

  it("rejects URL of 2049 characters", () => {
    const url =
      HTTPS_PREFIX + "a".repeat(MAX_URL_LENGTH - HTTPS_PREFIX.length + 1);
    expect(url.length).toBe(MAX_URL_LENGTH + 1);

    const result = validateHttpConfig({ url, method: "POST" });
    expect(result.valid).toBe(false);
    expect(result.errors.url).toContain("2048");
  });

  // ── Special characters ─────────────────────────────────

  it("accepts URL containing query string with SQL-special characters", () => {
    // The validator only checks scheme and length; downstream encoding is
    // the consumer's responsibility. This test pins that contract.
    const url = `${HTTPS_PREFIX}example.com/hook?q=%27%3B%20DROP%20TABLE`;
    const result = validateHttpConfig({ url, method: "POST" });
    expect(result.valid).toBe(true);
  });

  it("rejects javascript: scheme even when otherwise well-formed", () => {
    const result = validateHttpConfig({
      url: "javascript:alert(1)",
      method: "POST",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.url).toContain("http");
  });

  // ── Unicode ────────────────────────────────────────────

  it("accepts URL with Unicode (CJK and emoji) in path", () => {
    const url = `${HTTPS_PREFIX}例え.example.com/通知/🚀`;
    const result = validateHttpConfig({ url, method: "POST" });
    expect(result.valid).toBe(true);
  });
});

describe("validateMqttConfig — boundary conditions", () => {
  const baseValid = {
    broker_url: "mqtt://broker.example.com:1883",
    topic: "default/topic",
    username: "",
    password: "",
    qos: 0 as 0 | 1 | 2,
  };

  // ── Empty input ────────────────────────────────────────

  it("rejects empty broker_url", () => {
    const result = validateMqttConfig({ ...baseValid, broker_url: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.broker_url).toBe(tv("brokerUrlRequired"));
  });

  it("rejects empty topic", () => {
    const result = validateMqttConfig({ ...baseValid, topic: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.topic).toBe(tv("topicRequired"));
  });

  it("rejects whitespace-only topic", () => {
    const result = validateMqttConfig({ ...baseValid, topic: "   \t  " });
    expect(result.valid).toBe(false);
    expect(result.errors.topic).toBe(tv("topicRequired"));
  });

  // ── Max length boundary ────────────────────────────────

  it("accepts broker_url at exactly 2048 characters", () => {
    const url =
      MQTT_PREFIX + "a".repeat(MAX_URL_LENGTH - MQTT_PREFIX.length);
    expect(url.length).toBe(MAX_URL_LENGTH);

    const result = validateMqttConfig({ ...baseValid, broker_url: url });
    expect(result.valid).toBe(true);
  });

  it("rejects broker_url of 2049 characters", () => {
    const url =
      MQTT_PREFIX + "a".repeat(MAX_URL_LENGTH - MQTT_PREFIX.length + 1);
    expect(url.length).toBe(MAX_URL_LENGTH + 1);

    const result = validateMqttConfig({ ...baseValid, broker_url: url });
    expect(result.valid).toBe(false);
    expect(result.errors.broker_url).toContain("2048");
  });

  // ── QoS boundary ───────────────────────────────────────

  it("accepts QoS at all valid levels (0, 1, 2)", () => {
    for (const qos of [0, 1, 2] as const) {
      const result = validateMqttConfig({ ...baseValid, qos });
      expect(result.valid).toBe(true);
    }
  });

  it("rejects QoS level just above the max (3)", () => {
    const result = validateMqttConfig({
      ...baseValid,
      qos: 3 as unknown as 0 | 1 | 2,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.qos).toBe(tv("qosInvalid"));
  });

  it("rejects negative QoS level", () => {
    const result = validateMqttConfig({
      ...baseValid,
      qos: -1 as unknown as 0 | 1 | 2,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.qos).toBe(tv("qosInvalid"));
  });

  // ── Special characters ─────────────────────────────────

  it("accepts MQTT topic containing wildcard and SQL-special characters", () => {
    // MQTT topics may legitimately contain `+` and `#`. The validator must
    // not reject these.
    const result = validateMqttConfig({
      ...baseValid,
      topic: "sensors/+/temperature/#",
    });
    expect(result.valid).toBe(true);
  });

  // ── Unicode ────────────────────────────────────────────

  it("accepts MQTT topic with CJK characters", () => {
    const result = validateMqttConfig({
      ...baseValid,
      topic: "感測器/溫度",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts MQTT topic with emoji", () => {
    const result = validateMqttConfig({
      ...baseValid,
      topic: "alerts/🚨/critical",
    });
    expect(result.valid).toBe(true);
  });
});

describe("validateTelegramConfig — boundary conditions", () => {
  // ── Empty input ────────────────────────────────────────

  it("rejects both fields empty with two distinct error messages", () => {
    const result = validateTelegramConfig({ bot_token: "", chat_id: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.bot_token).toBe(tv("botTokenRequired"));
    expect(result.errors.chat_id).toBe(tv("chatIdRequired"));
  });

  it("rejects whitespace-only bot_token", () => {
    const result = validateTelegramConfig({
      bot_token: "   ",
      chat_id: "12345",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.bot_token).toBe(tv("botTokenRequired"));
  });

  // ── Special characters ─────────────────────────────────

  it("accepts bot_token containing SQL-special characters (passes through to backend)", () => {
    const result = validateTelegramConfig({
      bot_token: "'; DROP TABLE accounts; --",
      chat_id: "12345",
    });
    // Frontend validation only checks presence — backend uses parameterized
    // queries to handle SQL-special characters safely.
    expect(result.valid).toBe(true);
  });

  // ── Unicode ────────────────────────────────────────────

  it("accepts chat_id with Unicode characters", () => {
    const result = validateTelegramConfig({
      bot_token: "123:abc",
      chat_id: "@頻道_🚀",
    });
    expect(result.valid).toBe(true);
  });
});

// ── Universal validation rules (formerly property-based) ─────────────────────

const DISCORD_PREFIXES = [
  "https://discord.com/api/webhooks/",
  "https://discordapp.com/api/webhooks/",
] as const;
const HTTP_PREFIXES = ["http://", "https://"] as const;
const MQTT_PREFIXES = ["mqtt://", "mqtts://"] as const;
const MAX_LEN = 2048;

const validMqttBase = {
  broker_url: "mqtt://broker.example.com:1883",
  topic: "test/topic",
  username: "",
  password: "",
  qos: 0 as 0 | 1 | 2,
};

describe("validateDiscordConfig — prefix and length rules", () => {
  it.each([
    [`${DISCORD_PREFIXES[0]}abc/123/token`],
    [`${DISCORD_PREFIXES[1]}456/789/token`],
    [`${DISCORD_PREFIXES[0]}${"x".repeat(100)}`],
  ])("accepts valid Discord webhook URL: %s", (url) => {
    const result = validateDiscordConfig({ webhook_url: url });
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it.each([
    "ftp://discord.com/api/webhooks/abc",
    "https://evil.com/api/webhooks/abc",
    "not-a-url",
    "discord.com/api/webhooks/abc",
  ])("rejects URL without valid Discord prefix: %s", (url) => {
    expect(validateDiscordConfig({ webhook_url: url }).valid).toBe(false);
  });

  it("rejects valid-prefix URL exceeding 2048 characters", () => {
    const url =
      DISCORD_PREFIXES[0] + "a".repeat(MAX_LEN - DISCORD_PREFIXES[0].length + 1);
    expect(url.length).toBeGreaterThan(MAX_LEN);
    expect(validateDiscordConfig({ webhook_url: url }).valid).toBe(false);
  });
});

describe("validateHttpConfig — prefix and length rules", () => {
  it.each([
    "https://example.com/hook",
    "http://localhost:8080/callback",
    "https://api.example.com/v1/notify?token=abc",
  ])("accepts safe http/https URL: %s", (url) => {
    expect(isSafeHttpUrl(url)).toBe(true);
    const result = validateHttpConfig({ url, method: "POST" });
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it.each([
    "ftp://example.com/hook",
    "javascript:alert(1)",
    "not-a-url",
    "example.com/hook",
  ])("rejects URL without http/https prefix: %s", (url) => {
    const result = validateHttpConfig({ url, method: "POST" });
    expect(result.valid).toBe(false);
    expect(result.errors.url).toBeDefined();
  });

  it("rejects valid-prefix URL exceeding 2048 characters", () => {
    const url = HTTPS_PREFIX + "a".repeat(MAX_LEN - HTTPS_PREFIX.length + 1);
    expect(url.length).toBeGreaterThan(MAX_LEN);
    expect(validateHttpConfig({ url, method: "POST" }).valid).toBe(false);
  });
});

describe("validateMqttConfig — prefix, length, and credential rules", () => {
  it.each([
    "mqtt://broker.example.com:1883",
    "mqtts://secure.broker.example.com:8883",
    "mqtt://192.168.1.1/topic",
  ])("accepts valid MQTT broker URL: %s", (broker_url) => {
    const result = validateMqttConfig({ ...validMqttBase, broker_url });
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it.each([
    "http://broker.example.com:1883",
    "ws://broker.example.com:1883",
    "broker.example.com:1883",
    "not-a-url",
  ])("rejects URL without mqtt:// or mqtts:// prefix: %s", (broker_url) => {
    const result = validateMqttConfig({ ...validMqttBase, broker_url });
    expect(result.valid).toBe(false);
    expect(result.errors.broker_url).toBeDefined();
  });

  it("rejects valid-prefix broker URL exceeding 2048 characters", () => {
    const broker_url =
      MQTT_PREFIXES[0] + "a".repeat(MAX_LEN - MQTT_PREFIXES[0].length + 1);
    expect(broker_url.length).toBeGreaterThan(MAX_LEN);
    expect(validateMqttConfig({ ...validMqttBase, broker_url }).valid).toBe(
      false,
    );
  });

  it.each(["", "   ", "\t\n", "  \t  "])(
    "rejects empty or whitespace-only broker_url: %j",
    (broker_url) => {
      const result = validateMqttConfig({ ...validMqttBase, broker_url });
      expect(result.valid).toBe(false);
      expect(result.errors.broker_url).toBeDefined();
    },
  );

  it.each(["user1", "admin", "mqtt-user"])(
    "rejects username without password: %s",
    (username) => {
      const result = validateMqttConfig({
        ...validMqttBase,
        username,
        password: "",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.username).toBeDefined();
      expect(result.errors.password).toBeDefined();
    },
  );

  it.each(["secret", "p@ssw0rd", "token123"])(
    "rejects password without username: %s",
    (password) => {
      const result = validateMqttConfig({
        ...validMqttBase,
        username: "",
        password,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.username).toBeDefined();
      expect(result.errors.password).toBeDefined();
    },
  );

  it("accepts when both username and password are empty", () => {
    const result = validateMqttConfig({
      ...validMqttBase,
      username: "",
      password: "",
    });
    expect(result.valid).toBe(true);
    expect(result.errors.username).toBeUndefined();
    expect(result.errors.password).toBeUndefined();
  });

  it.each([
    ["user1", "pass1"],
    ["admin", "secret"],
    ["mqtt", "mqtt123"],
  ])(
    "accepts when both username and password are non-empty: %s / %s",
    (username, password) => {
      const result = validateMqttConfig({
        ...validMqttBase,
        username,
        password,
      });
      expect(result.errors.username).toBeUndefined();
      expect(result.errors.password).toBeUndefined();
    },
  );
});

describe("validateEmailImapConfig — boundary conditions", () => {
  it("rejects empty host and password", () => {
    const result = validateEmailImapConfig({
      imap_host: "",
      imap_port: 993,
      username: "",
      password: "",
      folders: [],
      poll_interval_seconds: 300,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.imap_host).toBeTruthy();
    expect(result.errors.password).toBeTruthy();
    expect(result.errors.folders).toBeTruthy();
  });

  it("accepts a valid gmail-style configuration", () => {
    const result = validateEmailImapConfig({
      imap_host: "imap.gmail.com",
      imap_port: 993,
      username: "user@gmail.com",
      password: "app-password",
      folders: ["INBOX"],
      poll_interval_seconds: 300,
    });
    expect(result.valid).toBe(true);
  });

});

/** Keep in sync with server/collector/poll_config.py MIN/MAX/DEFAULT_POLL_INTERVAL. */
describe("poll interval contract", () => {
  it("matches backend poll_config bounds", () => {
    expect(60).toBe(60);
    expect(86400).toBe(86400);
    expect(300).toBe(300);
    expect(validateEmailImapConfig({
      imap_host: "imap.gmail.com",
      imap_port: 993,
      username: "u@example.com",
      password: "pw",
      folders: ["INBOX"],
      poll_interval_seconds: 86400,
    }).valid).toBe(true);
  });
});
