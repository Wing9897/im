import { describe, expect, it } from "vitest";

import type { ChannelWithAccount } from "../types";
import { groupChannelsForPicker } from "./groupChannelsForPicker";

function makeChannel(
  platform: string,
  id: string,
  opts: Partial<ChannelWithAccount> = {},
): ChannelWithAccount {
  return {
    id: `${platform}:${id}`,
    platform,
    platformId: id,
    channelName: opts.channelName ?? `Channel ${id}`,
    accountIds: opts.accountIds ?? [opts.accountId ?? `acc-${id}`],
    accountId: opts.accountId ?? `acc-${id}`,
    accountName: opts.accountName ?? `Account ${id}`,
  };
}

describe("groupChannelsForPicker", () => {
  it("groups telegram channels by account under platform", () => {
    const grouped = groupChannelsForPicker([
      makeChannel("telegram", "10001", { accountId: "acc-a", accountName: "Bot A", channelName: "News" }),
      makeChannel("telegram", "10002", { accountId: "acc-a", accountName: "Bot A", channelName: "Alerts" }),
      makeChannel("telegram", "20001", { accountId: "acc-b", accountName: "Bot B", channelName: "Dev" }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].pickerLayout).toBe("account-tree");
    expect(grouped[0].accounts).toHaveLength(2);
    expect(grouped[0].accounts[0].channels).toHaveLength(2);
  });

  it("lists rss feeds flat under platform without account headers", () => {
    const grouped = groupChannelsForPicker([
      makeChannel("rss", "https://example.com/feed.xml", {
        accountId: "feed-1",
        accountName: "Example Feed",
        channelName: "Example Feed",
      }),
    ]);

    expect(grouped[0].pickerLayout).toBe("flat");
    expect(grouped[0].accounts).toHaveLength(1);
    expect(grouped[0].accounts[0].channels[0].platformId).toBe("https://example.com/feed.xml");
  });
});
