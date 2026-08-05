import { describe, expect, it } from "vitest";

import type { ChannelWithSource } from "../types";
import { groupChannelsForPicker } from "./groupChannelsForPicker";

function makeChannel(
  platform: string,
  id: string,
  opts: Partial<ChannelWithSource> = {},
): ChannelWithSource {
  return {
    id: `${platform}:${id}`,
    platform,
    platformId: id,
    channelName: opts.channelName ?? `Channel ${id}`,
    sourceIds: opts.sourceIds ?? [opts.sourceId ?? `acc-${id}`],
    sourceId: opts.sourceId ?? `acc-${id}`,
    sourceName: opts.sourceName ?? `Source ${id}`,
  };
}

describe("groupChannelsForPicker", () => {
  it("groups telegram channels by source under platform", () => {
    const grouped = groupChannelsForPicker([
      makeChannel("telegram", "10001", { sourceId: "acc-a", sourceName: "Bot A", channelName: "News" }),
      makeChannel("telegram", "10002", { sourceId: "acc-a", sourceName: "Bot A", channelName: "Alerts" }),
      makeChannel("telegram", "20001", { sourceId: "acc-b", sourceName: "Bot B", channelName: "Dev" }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].pickerLayout).toBe("source-tree");
    expect(grouped[0].sources).toHaveLength(2);
    expect(grouped[0].sources[0].channels).toHaveLength(2);
  });

  it("lists rss feeds flat under platform without source headers", () => {
    const grouped = groupChannelsForPicker([
      makeChannel("rss", "https://example.com/feed.xml", {
        sourceId: "feed-1",
        sourceName: "Example Feed",
        channelName: "Example Feed",
      }),
    ]);

    expect(grouped[0].pickerLayout).toBe("flat");
    expect(grouped[0].sources).toHaveLength(1);
    expect(grouped[0].sources[0].channels[0].platformId).toBe("https://example.com/feed.xml");
  });
});
