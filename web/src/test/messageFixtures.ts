import type { Message } from "../types";

/** Shared Message fixture for unit tests. */
export function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "m1",
    sourceId: "a1",
    platformId: "c1",
    channelName: "Test Channel",
    platform: "telegram",
    platformMessageId: "pm1",
    senderId: "u1",
    senderName: "Alice",
    content: "Test message",
    timestamp: "2024-06-01T12:00:00Z",
    rawData: null,
    createdAt: "2024-06-01T12:00:00Z",
    ...overrides,
  };
}
