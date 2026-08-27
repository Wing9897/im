import { describe, expect, it } from "vitest";
import {
  calendarShareKey,
  isOwnCalendarHandle,
  isSubscribedTimelineSource,
  parseCalendarSharePath,
  parseSubscribedTimelineSource,
  parseSubscribedCalendarSelection,
  pruneSubscribedCalendarSelection,
  resolvedSubscribeKeys,
  resolveSubscribeAvailability,
  isCalendarShareUnreachable,
  subscribedEventVisible,
  subscribedTimelineSource,
  toggleSubscribeKey,
} from "./subscribedCalendars";

describe("subscribedCalendars", () => {
  it("parses handle/slug and rejects own handle", () => {
    expect(parseCalendarSharePath(" Alice/Work ")).toEqual({ handle: "Alice", slug: "Work" });
    expect(parseCalendarSharePath("Alice")).toBeNull();
    expect(isOwnCalendarHandle("Wing", "wing")).toBe(true);
    expect(isOwnCalendarHandle("Alice", "Wing")).toBe(false);
    expect(calendarShareKey("Alice", "Work")).toBe("Alice/Work");
    expect(subscribedTimelineSource("Alice", "Work")).toBe("subscribed:Alice/Work");
    expect(isSubscribedTimelineSource("subscribed:Alice/Work")).toBe(true);
    expect(isSubscribedTimelineSource("user")).toBe(false);
    expect(parseSubscribedTimelineSource("subscribed:Alice/Work")).toBe("Alice/Work");
    expect(parseSubscribedTimelineSource("user")).toBeNull();
  });

  it("normalizes persisted display-filter values", () => {
    expect(parseSubscribedCalendarSelection(null)).toBeNull();
    expect(parseSubscribedCalendarSelection(undefined)).toBeNull();
    expect(parseSubscribedCalendarSelection({ foo: 1 })).toBeNull();
    expect(parseSubscribedCalendarSelection([" Alice/Work ", "", "Carol/Team"])).toEqual([
      "Alice/Work",
      "Carol/Team",
    ]);
  });

  it("prunes missing keys and filters events", () => {
    expect(pruneSubscribedCalendarSelection(["Alice/Work", "gone"], ["Alice/Work"])).toEqual([
      "Alice/Work",
    ]);
    expect(pruneSubscribedCalendarSelection(["Alice/Work"], [])).toEqual(["Alice/Work"]);
    expect(resolvedSubscribeKeys(null, [])).toEqual([]);
    expect(resolvedSubscribeKeys(null, ["Alice/Work", "Carol/Team"])).toEqual(["Alice/Work", "Carol/Team"]);
    expect(resolvedSubscribeKeys(["DemoPub/Open"], [])).toEqual([]);
    expect(resolvedSubscribeKeys(["Alice/Work", "DemoPub/Open"], ["Alice/Work"])).toEqual(["Alice/Work"]);
    expect(subscribedEventVisible("subscribed:Alice/Work", null)).toBe(false);
    expect(subscribedEventVisible("subscribed:Alice/Work", null, ["Alice/Work"])).toBe(true);
    expect(subscribedEventVisible("subscribed:DemoPub/Open", null, ["Alice/Work"])).toBe(false);
    expect(subscribedEventVisible("subscribed:Alice/Work", [])).toBe(false);
    expect(subscribedEventVisible("subscribed:Alice/Work", ["Alice/Work"], ["Alice/Work"])).toBe(true);
    expect(subscribedEventVisible("user", ["Alice/Work"], ["Alice/Work"])).toBe(false);
  });

  it("toggles catalog keys and collapses full selection to null", () => {
    expect(toggleSubscribeKey(null, "Alice/Work", ["Alice/Work", "Carol/Team"])).toEqual([
      "Carol/Team",
    ]);
    expect(toggleSubscribeKey(["Carol/Team"], "Alice/Work", ["Alice/Work", "Carol/Team"])).toBeNull();
  });

  it("distinguishes logged-out from calendar-share unreachable", () => {
    expect(resolveSubscribeAvailability({ connected: false, catalogUnreachable: true })).toBe("loggedOut");
    expect(resolveSubscribeAvailability({ connected: true, catalogUnreachable: true })).toBe("offline");
    expect(resolveSubscribeAvailability({ connected: true, eventsError: "calendar share 502" })).toBe(
      "offline",
    );
    expect(resolveSubscribeAvailability({ connected: true })).toBe("ok");
    expect(isCalendarShareUnreachable("calendar share 502")).toBe(true);
    expect(isCalendarShareUnreachable("Not signed in to calendar share")).toBe(false);
  });
});
