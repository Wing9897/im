import { describe, expect, it, vi } from "vitest";

import type { Message } from "../../types";
import {
  clearMessageFilterKey,
  describeActiveMessageFilters,
  getMessageListWindow,
  matchesFilters,
  normalizeMonitorFilters,
} from "./monitorPageModel";
import { contentFadeClass } from "../../components/ui/pageLayout";
import {
  monitorStreamStatusLabel,
  monitorWallStatusLabel,
} from "./monitorStatusLabel";
import { isMonitorViewMode } from "../../domain/monitor/monitorViewMode";

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: overrides.id ?? "m1",
    accountId: overrides.accountId ?? "a1",
    channelId: overrides.channelId ?? "c1",
    channelName: overrides.channelName ?? "News",
    platform: overrides.platform ?? "telegram",
    platformMessageId: overrides.platformMessageId ?? "pm1",
    senderId: overrides.senderId ?? "sender-1",
    senderName: overrides.senderName ?? "Alice",
    content: overrides.content ?? "stablecoin listing update",
    timestamp: overrides.timestamp ?? "2026-04-15T08:00:00.000Z",
    rawData: overrides.rawData ?? null,
    createdAt: overrides.createdAt ?? "2026-04-15T08:00:01.000Z",
  };
}

describe("monitorPageModel", () => {
  it("prunes stale channelIds and accountIds once the catalog is known", () => {
    const result = normalizeMonitorFilters(
      {
        channelIds: ["telegram:gone", "telegram:keep"],
        accountIds: ["acct-gone", "acct-keep"],
        search: "btc",
      },
      [{ id: "acct-keep" }] as Parameters<typeof normalizeMonitorFilters>[1],
      [{ id: "telegram:keep" }],
    );
    expect(result.changed).toBe(true);
    expect(result.filters).toEqual({
      channelIds: ["telegram:keep"],
      accountIds: ["acct-keep"],
      search: "btc",
    });
  });

  it("matches text search against sender, channel, and content fields", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T09:00:00.000Z"));

    const message = makeMessage({
      senderName: "Bob",
      channelName: "Alpha News",
      content: "Regulation update",
    });

    expect(matchesFilters(message, { search: "alpha" })).toBe(true);
    expect(matchesFilters(message, { search: "regulation" })).toBe(true);
    expect(matchesFilters(message, { search: "charlie" })).toBe(false);

    vi.useRealTimers();
  });

  it("returns only the visible list window slice in list mode", () => {
    const messages = Array.from({ length: 100 }, (_, index) =>
      makeMessage({ id: `msg-${index}` }),
    );
    const listEl = document.createElement("div");
    const scrollRoot = document.createElement("div");
    scrollRoot.style.overflowY = "auto";
    scrollRoot.style.height = "400px";
    scrollRoot.appendChild(listEl);
    document.body.appendChild(scrollRoot);

    listEl.getBoundingClientRect = () =>
      ({
        top: 40,
        bottom: 40 + 100 * 33,
        left: 0,
        right: 800,
        width: 800,
        height: 100 * 33,
        x: 0,
        y: 40,
        toJSON: () => ({}),
      }) as DOMRect;
    scrollRoot.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 400,
        left: 0,
        right: 800,
        width: 800,
        height: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    const window = getMessageListWindow({
      viewMode: "list",
      messages,
      listContainerNode: listEl,
    });

    expect(window.visibleMessages.length).toBeLessThan(messages.length);
    expect(
      window.topSpacerHeight +
        window.visibleMessages.length * 33 +
        window.bottomSpacerHeight,
    ).toBe(messages.length * 33);

    scrollRoot.remove();
  });
});

describe("monitorPageStyles", () => {
  it("keeps content fade transition for list/card panes", () => {
    expect(contentFadeClass).toContain("im-content-fade");
    expect(contentFadeClass).toContain("opacity-100");
  });
});

describe("monitorViewMode", () => {
  it("accepts card, list, and wall", () => {
    expect(isMonitorViewMode("card")).toBe(true);
    expect(isMonitorViewMode("list")).toBe(true);
    expect(isMonitorViewMode("wall")).toBe(true);
  });

  it("rejects map and unknown values", () => {
    expect(isMonitorViewMode("map")).toBe(false);
    expect(isMonitorViewMode("invalid")).toBe(false);
    expect(isMonitorViewMode(null)).toBe(false);
  });
});

describe("monitorStatusLabel", () => {
  it("formats stream status while paginating", () => {
    expect(
      monitorStreamStatusLabel({
        initialLoading: false,
        messagesLength: 50,
        totalCount: 200,
        hasMore: true,
      }),
    ).toBe("已載入 50 / 200 則訊息，向下捲動載入更多");
  });

  it("formats wall status for selected channels", () => {
    expect(monitorWallStatusLabel(3, false, 2800, false, 12)).toBe(
      "訊息牆 · 3 頻道 · 2,800 則 · 牆上 12",
    );
  });

  it("omits wall loaded suffix when queue is empty", () => {
    expect(monitorWallStatusLabel(2, false, 100, false, 0)).toBe(
      "訊息牆 · 2 頻道 · 100 則",
    );
  });

  it("formats stream status when all pages are loaded", () => {
    expect(
      monitorStreamStatusLabel({
        initialLoading: false,
        messagesLength: 500,
        totalCount: 500,
        hasMore: false,
      }),
    ).toBe("共 500 則訊息");
  });

  it("describes and clears active filter chips", () => {
    const chips = describeActiveMessageFilters({
      search: "btc",
      platform: "telegram",
      timeRange: "today",
      accountIds: ["a1", "a2"],
      channelIds: ["telegram:1"],
    });
    expect(chips.map((chip) => chip.key)).toEqual([
      "search",
      "platform",
      "timeRange",
      "accounts",
      "channels",
    ]);
    expect(clearMessageFilterKey({ search: "btc", platform: "telegram" }, "search")).toEqual({
      search: undefined,
      platform: "telegram",
    });
  });
});
