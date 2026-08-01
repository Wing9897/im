import { describe, expect, it } from "vitest";
import {
  EVENT_STATUS_COLORS,
  getEventStatusColor,
  type EventStatus,
} from "./status";

describe("timeline status domain", () => {
  it("defines a color for every display status", () => {
    const statuses: EventStatus[] = [
      "pending",
      "confirmed",
      "completed",
      "cancelled",
    ];

    for (const status of statuses) {
      expect(getEventStatusColor(status)).toBe(EVENT_STATUS_COLORS[status]);
    }
  });
});
