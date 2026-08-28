import { describe, expect, it } from "vitest";
import {
  calendarShareKey,
  isCatalogSubscribed,
  isOwnCalendarHandle,
  isSubscribedTimelineSource,
  looksLikeCalendarSharePath,
  matchesCalendarShareFilter,
  parseCalendarSharePath,
  parseSubscribedTimelineSource,
  parseSubscribedCalendarSelection,
  pruneSubscribedCalendarSelection,
  resolvedSubscribeKeys,
  resolveSubscribeAvailability,
  subscribeCalendarIdentity,
  subscribeFilterCalendarsFromCatalog,
  subscribePageStatus,
  isCalendarShareUnreachable,
  isCalendarShareNotFound,
  subscribedEventVisible,
  subscribedTimelineSource,
  toggleSubscribeKey,
} from "./subscribedCalendars";

describe("subscribedCalendars", () => {
  it("parses handle/slug and rejects own handle", () => {
    expect(parseCalendarSharePath(" Alice/Work ")).toEqual({ handle: "Alice", slug: "Work" });
    expect(parseCalendarSharePath("Alice")).toBeNull();
    expect(looksLikeCalendarSharePath("Alice/Work")).toBe(true);
    expect(looksLikeCalendarSharePath("Alice")).toBe(false);
    expect(matchesCalendarShareFilter("ops", "Wing", "Ops", "Operations")).toBe(true);
    expect(matchesCalendarShareFilter("zzz", "Wing", "Ops")).toBe(false);
    expect(matchesCalendarShareFilter("  ", "Wing")).toBe(true);
    expect(isOwnCalendarHandle("Wing", "wing")).toBe(true);
    expect(isOwnCalendarHandle("Alice", "Wing")).toBe(false);
    expect(calendarShareKey("Alice", "Work")).toBe("Alice/Work");
    expect(isCatalogSubscribed([{ handle: "DemoPub", slug: "Open" }], "demopub", "open")).toBe(true);
    expect(isCatalogSubscribed([{ handle: "DemoPub", slug: "Open" }], "Alice", "Work")).toBe(false);
    expect(isCatalogSubscribed([], "Alice", "Work")).toBe(false);
    expect(subscribeCalendarIdentity({ handle: " Alice ", slug: " Work ", ownerAvatar: "data:image/png;base64,a", cover: "data:image/jpeg;base64,c" })).toEqual({
      key: "Alice/Work",
      label: "Alice/Work",
      ownerAvatar: "data:image/png;base64,a",
      cover: "data:image/jpeg;base64,c",
      handle: "Alice",
      slug: "Work",
    });
    expect(subscribeCalendarIdentity({ handle: "Alice", slug: "Work" }).ownerAvatar).toBe("");
    expect(
      subscribeFilterCalendarsFromCatalog([
        { handle: "Alice", slug: "Work", ownerAvatar: "data:image/png;base64,a", cover: "data:image/jpeg;base64,c" },
        { handle: "Carol", slug: "Team" },
      ]),
    ).toEqual([
      {
        key: "Alice/Work",
        label: "Alice/Work",
        ownerAvatar: "data:image/png;base64,a",
        cover: "data:image/jpeg;base64,c",
        handle: "Alice",
        slug: "Work",
      },
      {
        key: "Carol/Team",
        label: "Carol/Team",
        ownerAvatar: "",
        cover: "",
        handle: "Carol",
        slug: "Team",
      },
    ]);
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
    expect(isCalendarShareNotFound(new Error("Not found"))).toBe(true);
    expect(isCalendarShareNotFound({ status: 404, message: "Calendar missing" })).toBe(true);
    expect(isCalendarShareNotFound({ errorCode: "NOT_FOUND", message: "gone" })).toBe(true);
    expect(isCalendarShareNotFound("Calendar share is unreachable")).toBe(false);
  });

  it("keeps the first catalog paint in loading until session is known", () => {
    expect(subscribePageStatus({ loading: true, connected: null })).toBe("loading");
    expect(subscribePageStatus({ loading: true, connected: false })).toBe("loggedOut");
    expect(subscribePageStatus({ loading: false, connected: false })).toBe("loggedOut");
    expect(subscribePageStatus({ loading: true, connected: true, unreachable: true })).toBe("offline");
    expect(subscribePageStatus({ loading: false, connected: true })).toBe("ok");
  });
});
