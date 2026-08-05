import { describe, expect, it } from "vitest";

import { platformColor, groupChannelsByPlatform } from "./platform";
import type { ChannelWithSource } from "../types";

describe("platformColor", () => {
  it("returns CSS variables for known platforms", () => {
    expect(platformColor("telegram")).toBe("var(--platform-telegram)");
    expect(platformColor("rss")).toBe("var(--platform-rss)");
    expect(platformColor("http")).toBe("var(--platform-http)");
    expect(platformColor("email")).toBe("var(--platform-email)");
    expect(platformColor("mqtt")).toBe("var(--platform-mqtt)");
    expect(platformColor("api")).toBe("var(--platform-api)");
    expect(platformColor("discord")).toBe("var(--platform-discord)");
  });

  it("returns the default CSS variable for unknown platforms", () => {
    expect(platformColor("customfeed")).toBe("var(--platform-default)");
    expect(platformColor("")).toBe("var(--platform-default)");
  });
});

describe("groupChannelsByPlatform", () => {
  function makeChannel(platform: string, id: string): ChannelWithSource {
    return {
      id,
      platform: platform as ChannelWithSource["platform"],
      platformId: `ch-${id}`,
      channelName: `Channel ${id}`,
      sourceIds: [`acc-${id}`],
      sourceId: `acc-${id}`,
      sourceName: `Source ${id}`,
    };
  }

  it("returns an empty array for empty input", () => {
    expect(groupChannelsByPlatform([])).toEqual([]);
  });

  it("groups channels by platform", () => {
    const channels = [
      makeChannel("telegram", "1"),
      makeChannel("telegram", "2"),
      makeChannel("rss", "3"),
    ];
    const result = groupChannelsByPlatform(channels);
    expect(result).toHaveLength(2);
    expect(result[0][0]).toBe("telegram");
    expect(result[0][1]).toHaveLength(2);
    expect(result[1][0]).toBe("rss");
    expect(result[1][1]).toHaveLength(1);
  });

  it("sorts known platforms in canonical order", () => {
    const channels = [
      makeChannel("discord", "1"),
      makeChannel("telegram", "2"),
      makeChannel("rss", "3"),
      makeChannel("http", "7"),
      makeChannel("email", "5"),
      makeChannel("mqtt", "6"),
      makeChannel("api", "4"),
    ];
    const result = groupChannelsByPlatform(channels);
    const platforms = result.map(([p]) => p);
    expect(platforms).toEqual(["telegram", "discord", "rss", "http", "mqtt", "email", "api"]);
  });

  it("places unknown platforms after known ones in alphabetical order", () => {
    const channels = [
      makeChannel("customfeed", "1"),
      makeChannel("telegram", "2"),
      makeChannel("webhook", "3"),
    ];
    const result = groupChannelsByPlatform(channels);
    const platforms = result.map(([p]) => p);
    expect(platforms).toEqual(["telegram", "customfeed", "webhook"]);
  });
});
