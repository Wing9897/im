import { afterEach, describe, expect, it } from "vitest";

import { TIMELINE_SUBSCRIBED_DISMISSALS_STORAGE_KEY } from "../prefs";
import { makeEvent } from "../../test/timelineTestHelpers";
import {
  applySubscribedDismissals,
  markSubscribedEventDismissed,
  pruneSubscribedDismissals,
} from "./subscribedDismissals";

describe("subscribedDismissals", () => {
  afterEach(() => {
    window.localStorage.removeItem(TIMELINE_SUBSCRIBED_DISMISSALS_STORAGE_KEY);
  });

  it("prunes dismissals whose calendar left the catalog", () => {
    const kept = makeEvent({
      id: "Alice/Work:evt-1",
      source: "subscribed:Alice/Work",
    });
    const gone = makeEvent({
      id: "Carol/Team:evt-2",
      source: "subscribed:Carol/Team",
    });
    markSubscribedEventDismissed(kept);
    markSubscribedEventDismissed(gone);

    pruneSubscribedDismissals(["Alice/Work"]);

    const merged = applySubscribedDismissals([
      { ...kept, dismissed: false },
      { ...gone, dismissed: false },
    ]);
    expect(merged[0]?.dismissed).toBe(true);
    expect(merged[1]?.dismissed).toBe(false);
  });
});
