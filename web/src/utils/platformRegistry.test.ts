import { beforeEach, describe, expect, it } from "vitest";

import { setAppLocale } from "../i18n/locale";
import {
  PLATFORM_ORDER,
  getPlatformSpec,
  platformDisplayLabel,
  platformScopeLabel,
} from "./platformRegistry";

describe("PLATFORM_ORDER", () => {
  it("lists all supported source platforms in tab order", () => {
    expect(PLATFORM_ORDER).toEqual([
      "telegram",
      "discord",
      "rss",
      "http",
      "mqtt",
      "email",
      "api",
    ]);
  });
});

describe("getPlatformSpec", () => {
  it("returns known platform metadata", () => {
    expect(getPlatformSpec("telegram")).toEqual({
      id: "telegram",
      label: "Telegram",
      pickerLayout: "source-tree",
      scopeLabelKey: "channel",
    });
    expect(getPlatformSpec("rss")).toEqual({
      id: "rss",
      label: "RSS",
      pickerLayout: "flat",
      scopeLabelKey: "feed",
    });
  });

  it("falls back for unknown platforms", () => {
    expect(getPlatformSpec("slack")).toMatchObject({
      id: "slack",
      label: "Slack",
      pickerLayout: "flat",
      scopeLabelKey: "source",
    });
  });
});

describe("platformDisplayLabel", () => {
  it("returns registry labels for known platforms", () => {
    expect(platformDisplayLabel("telegram")).toBe("Telegram");
    expect(platformDisplayLabel("rss")).toBe("RSS");
    expect(platformDisplayLabel("http")).toBe("HTTP");
    expect(platformDisplayLabel("email")).toBe("Email");
    expect(platformDisplayLabel("mqtt")).toBe("MQTT");
    expect(platformDisplayLabel("api")).toBe("Webhook");
    expect(platformDisplayLabel("discord")).toBe("Discord");
  });

  it('returns "Unknown" for empty input', () => {
    expect(platformDisplayLabel("")).toBe("Unknown");
    expect(platformDisplayLabel(null)).toBe("Unknown");
  });

  it("capitalizes the first letter for unknown non-empty platforms", () => {
    expect(platformDisplayLabel("customfeed")).toBe("Customfeed");
  });
});

describe("platformScopeLabel", () => {
  beforeEach(() => {
    setAppLocale("zh-Hant");
  });

  it("returns localized scope nouns for known platforms", () => {
    expect(platformScopeLabel("telegram")).toBe("頻道");
    expect(platformScopeLabel("discord")).toBe("頻道");
    expect(platformScopeLabel("rss")).toBe("Feed");
    expect(platformScopeLabel("http")).toBe("網址");
    expect(platformScopeLabel("mqtt")).toBe("Broker");
    expect(platformScopeLabel("email")).toBe("資料夾");
    expect(platformScopeLabel("api")).toBe("端點");
  });

  it("falls back to source for unknown platforms", () => {
    expect(platformScopeLabel("slack")).toBe("來源");
    expect(platformScopeLabel(null)).toBe("來源");
  });

  it("follows en locale", () => {
    setAppLocale("en");
    expect(platformScopeLabel("telegram")).toBe("Channel");
    expect(platformScopeLabel("email")).toBe("Folder");
    expect(platformScopeLabel("http")).toBe("URL");
    setAppLocale("zh-Hant");
  });
});
