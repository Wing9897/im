import { describe, expect, it } from "vitest";

import {
  buildChannelNameById,
  channelRefKey,
  resolveChannelLabel,
} from "./taskDetailFields";

describe("taskDetailFields", () => {
  it("resolves channel labels via shared helpers", () => {
    const ref = { id: "telegram:-1001", platform: "telegram" as const, platformId: "-1001" };
    expect(channelRefKey(ref)).toBe("telegram:-1001");
    expect(channelRefKey({ id: "", platform: "telegram", platformId: "-9" })).toBe("telegram:-9");

    const channelNameById = new Map([["telegram:-1001", "Alpha 群"]]);
    expect(resolveChannelLabel(ref, channelNameById)).toBe("Alpha 群");
    expect(resolveChannelLabel({ id: "", platform: "telegram", platformId: "-9" })).toContain("-9");
  });

  it("buildChannelNameById indexes by id and platform:platformId", () => {
    const channelNameById = buildChannelNameById([
      {
        id: "ch-uuid-1",
        platform: "telegram",
        platformId: "-1001",
        channelName: "Alpha 群",
        accountIds: [],
      },
    ]);

    expect(channelNameById.get("ch-uuid-1")).toBe("Alpha 群");
    expect(channelNameById.get("telegram:-1001")).toBe("Alpha 群");
  });
});
