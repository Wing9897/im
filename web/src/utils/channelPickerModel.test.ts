import { describe, expect, it } from "vitest";

import type { ChannelWithSource } from "../types";
import {
  channelDisplayHint,
  channelDisplayLabel,
  filterChannelsByQuery,
} from "./channelPickerModel";

function makeChannel(overrides: Partial<ChannelWithSource> = {}): ChannelWithSource {
  return {
    id: "rss:https://example.com/feed.xml",
    platform: "rss",
    platformId: "https://example.com/feed.xml",
    channelName: "Example",
    sourceIds: ["acc-1"],
    sourceId: "acc-1",
    sourceName: "Example Feed",
    ...overrides,
  };
}

describe("channelPickerModel", () => {
  it("filters channels by name, platform id, and source", () => {
    const channels = [
      makeChannel(),
      makeChannel({
        id: "telegram:1",
        platform: "telegram",
        platformId: "1",
        channelName: "News",
        sourceName: "Bot",
      }),
    ];
    expect(filterChannelsByQuery(channels, "news")).toHaveLength(1);
    expect(filterChannelsByQuery(channels, "example.com")).toHaveLength(1);
    expect(filterChannelsByQuery(channels, "bot")).toHaveLength(1);
  });

  it("formats flat rss rows with compact url hint", () => {
    const channel = makeChannel();
    expect(channelDisplayLabel(channel)).toBe("Example");
    expect(channelDisplayHint(channel, "flat")).toBe("example.com/feed.xml");
    expect(channelDisplayHint(channel, "source-tree")).toBe("");
  });
});
