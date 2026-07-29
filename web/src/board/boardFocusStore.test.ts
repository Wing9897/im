import { describe, expect, it, vi } from "vitest";
import {
  focusBoardEvent,
  getBoardFocusTarget,
  subscribeBoardFocus,
} from "./boardFocusStore";

describe("boardFocusStore", () => {
  it("dispatches an event focus target to map subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeBoardFocus(listener);

    focusBoardEvent({ eventId: "event-1", lat: 25.03, lon: 121.56 });

    expect(listener).toHaveBeenCalledOnce();
    expect(getBoardFocusTarget()).toMatchObject({
      eventId: "event-1",
      lat: 25.03,
      lon: 121.56,
    });
    unsubscribe();
  });
});
