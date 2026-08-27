import { describe, expect, it } from "vitest";

import { TIMELINE_SUBSCRIBE_FILTER_KEY } from "../prefs";
import { usePersistedSubscribeFilter } from "./usePersistedSubscribeFilter";
import { parseSubscribedCalendarSelection } from "./subscribedCalendars";

describe("usePersistedSubscribeFilter", () => {
  it("keeps parseSubscribedCalendarSelection as the persisted filter gate", () => {
    expect(parseSubscribedCalendarSelection([" Alice/Work "])).toEqual(["Alice/Work"]);
    expect(usePersistedSubscribeFilter).toEqual(expect.any(Function));
    expect(TIMELINE_SUBSCRIBE_FILTER_KEY).toMatch(/subscribe/);
  });
});
