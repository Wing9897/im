import { describe, expect, it } from "vitest";

import { makeTimelineItem } from "../../test/analysisEventFixtures";
import {
  lookupSubscribedCalendarDescription,
  lookupSubscribedOwnerAvatar,
  lookupSubscribedPublisherHandle,
  subscribeDescriptionByKeyFromCatalog,
  subscribeOwnerAvatarByHandleFromCatalog,
} from "./subscribedCatalogLookups";

describe("subscribedCatalogLookups", () => {
  it("looks up catalog descriptions by handle/slug", () => {
    const catalog = subscribeDescriptionByKeyFromCatalog([
      { handle: "DemoPub", slug: "Open", description: "Public office hours" },
    ]);
    expect(
      lookupSubscribedCalendarDescription(
        makeTimelineItem({ source: "subscribed:DemoPub/Open" }),
        catalog,
      ),
    ).toBe("Public office hours");
    expect(
      lookupSubscribedCalendarDescription(makeTimelineItem({ source: "user" }), catalog),
    ).toBe("");
  });

  it("looks up publisher avatar by handle from catalog", () => {
    const catalog = subscribeOwnerAvatarByHandleFromCatalog([
      { handle: "DemoPub", ownerAvatar: "data:image/png;base64,pub" },
    ]);
    expect(
      lookupSubscribedOwnerAvatar(makeTimelineItem({ source: "subscribed:DemoPub/Open" }), catalog),
    ).toBe("data:image/png;base64,pub");
    expect(lookupSubscribedPublisherHandle(makeTimelineItem({ source: "subscribed:DemoPub/Open" }))).toBe(
      "DemoPub",
    );
    expect(
      lookupSubscribedOwnerAvatar(makeTimelineItem({ source: "user" }), catalog),
    ).toBe("");
  });
});
