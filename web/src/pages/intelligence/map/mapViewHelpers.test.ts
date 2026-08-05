import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Message } from "../../../types";
import {
  readSharedDanmakuMode,
  SHARED_DANMAKU_MODE_KEY,
  MAP_TIME_WINDOW_STORAGE_KEY,
  parsePersistedMapTimeWindow,
  readStoredMapTimeWindow,
  serializeMapTimeWindow,
  writeStoredMapTimeWindow,
  sortMessagesDesc,
  MAX_RUNTIME_MESSAGES,
} from "./mapViewHelpers";

describe("readSharedDanmakuMode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns the shared key when it is already valid", () => {
    localStorage.setItem(SHARED_DANMAKU_MODE_KEY, "transient");

    expect(readSharedDanmakuMode()).toBe("transient");
    expect(localStorage.getItem(SHARED_DANMAKU_MODE_KEY)).toBe("transient");
  });

  it("defaults to persistent when no valid value exists", () => {
    expect(readSharedDanmakuMode()).toBe("persistent");
    expect(localStorage.getItem(SHARED_DANMAKU_MODE_KEY)).toBeNull();
  });

  it("defaults to persistent when shared key has invalid value", () => {
    localStorage.setItem(SHARED_DANMAKU_MODE_KEY, "invalid");

    expect(readSharedDanmakuMode()).toBe("persistent");
  });
});

describe("map time window persistence", () => {
  const fallback = {
    start: new Date("2026-01-01T00:00:00.000Z"),
    end: new Date("2026-01-02T00:00:00.000Z"),
  };

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("round-trips committed window through localStorage", () => {
    const window = {
      start: new Date("2026-04-10T08:00:00.000Z"),
      end: new Date("2026-04-12T20:00:00.000Z"),
    };
    writeStoredMapTimeWindow(MAP_TIME_WINDOW_STORAGE_KEY, window);
    const restored = readStoredMapTimeWindow(MAP_TIME_WINDOW_STORAGE_KEY, fallback);
    expect(restored.start.toISOString()).toBe(window.start.toISOString());
    expect(restored.end.toISOString()).toBe(window.end.toISOString());
  });

  it("parsePersistedMapTimeWindow rejects invalid payloads", () => {
    expect(parsePersistedMapTimeWindow(null, fallback)).toEqual(fallback);
    expect(parsePersistedMapTimeWindow({ start: "x", end: "y" }, fallback)).toEqual(fallback);
    expect(
      parsePersistedMapTimeWindow(
        serializeMapTimeWindow({
          start: new Date("2026-04-10T08:00:00.000Z"),
          end: new Date("2026-04-09T08:00:00.000Z"),
        }),
        fallback,
      ),
    ).toEqual(fallback);
  });
});

function makeMessage(id: string, timestamp: string): Message {
  return {
    id,
    sourceId: "acc-1",
    channelId: "ch-1",
    channelName: "general",
    platform: "discord",
    platformMessageId: `pm-${id}`,
    senderId: "user-1",
    senderName: "Alice",
    content: `Message ${id}`,
    timestamp,
    rawData: null,
    createdAt: timestamp,
  };
}

function accumulateMessages(prev: Message[], incoming: Message[]): Message[] {
  const nextById = new Map(prev.map((message) => [message.id, message]));
  for (const message of incoming) {
    nextById.set(message.id, message);
  }
  return sortMessagesDesc(Array.from(nextById.values())).slice(0, MAX_RUNTIME_MESSAGES);
}

function applyBatchSequence(batches: Message[][]): Message[] {
  let state: Message[] = [];
  for (const batch of batches) {
    if (batch.length > 0) {
      state = accumulateMessages(state, batch);
    }
  }
  return state;
}

describe("Message accumulation invariants", () => {
  const batches = [
    [
      makeMessage("m1", "2026-01-15T10:00:00.000Z"),
      makeMessage("m2", "2026-01-15T11:00:00.000Z"),
    ],
    [
      makeMessage("m2", "2026-01-15T11:30:00.000Z"),
      makeMessage("m3", "2026-01-15T09:00:00.000Z"),
    ],
    [makeMessage("m4", "2026-01-15T12:00:00.000Z")],
  ];

  it("no duplicate IDs exist in the accumulated result", () => {
    const result = applyBatchSequence(batches);
    const ids = result.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("messages are sorted in descending order by timestamp", () => {
    const result = applyBatchSequence(batches);
    for (let i = 0; i < result.length - 1; i++) {
      const currentTs = new Date(result[i].timestamp).getTime();
      const nextTs = new Date(result[i + 1].timestamp).getTime();
      expect(currentTs).toBeGreaterThanOrEqual(nextTs);
    }
  });

  it("total count does not exceed MAX_RUNTIME_MESSAGES", () => {
    const result = applyBatchSequence(batches);
    expect(result.length).toBeLessThanOrEqual(MAX_RUNTIME_MESSAGES);
  });
});
