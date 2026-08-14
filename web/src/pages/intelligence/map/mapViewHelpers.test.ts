import { describe, expect, it } from "vitest";
import type { Message } from "../../../types";
import {
  sortMessagesDesc,
  MAX_RUNTIME_MESSAGES,
} from "./mapViewHelpers";

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
