import { describe, expect, it, vi } from "vitest";

import type { Message } from "../../types";
import {
  clearMessageFilterKey,
  describeActiveMessageFilters,
  getMessageListWindow,
  matchesFilters,
  normalizeMonitorFilters,
} from "./monitorPageModel";
import { isMonitorViewMode } from "./monitorViewMode";

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: overrides.id ?? "m1",
    sourceId: overrides.sourceId ?? "a1",
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
  it("prunes stale channelIds and sourceIds once the catalog is known", () => {
    const result = normalizeMonitorFilters(
      {
        channelIds: ["telegram:gone", "telegram:keep"],
        sourceIds: ["acct-gone", "acct-keep"],
        search: "btc",
      },
      [{ id: "acct-keep" }] as Parameters<typeof normalizeMonitorFilters>[1],
      [{ id: "telegram:keep" }],
    );
    expect(result.changed).toBe(true);
    expect(result.filters).toEqual({
      channelIds: ["telegram:keep"],
      sourceIds: ["acct-keep"],
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

  it("describes and clears active filter chips", () => {
    const chips = describeActiveMessageFilters({
      search: "btc",
      platform: "telegram",
      timeRange: "today",
      sourceIds: ["a1", "a2"],
      channelIds: ["telegram:1"],
    });
    expect(chips.map((chip) => chip.key)).toEqual([
      "search",
      "platform",
      "timeRange",
      "sources",
      "channels",
    ]);
    expect(clearMessageFilterKey({ search: "btc", platform: "telegram" }, "search")).toEqual({
      search: undefined,
      platform: "telegram",
    });
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
