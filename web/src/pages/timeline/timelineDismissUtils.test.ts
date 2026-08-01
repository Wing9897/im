import { describe, expect, it } from "vitest";

import { makeEvent } from "../../test/timelineTestHelpers";
import {
  partitionDismissed,
  preferActiveEvents,
  sortActiveThenDismissed,
} from "./timelineDismissUtils";

describe("timelineDismissUtils", () => {
  it("partitions active and dismissed buckets", () => {
    const active = makeEvent({ id: "a", dismissed: false });
    const dismissed = makeEvent({ id: "d", dismissed: true });
    expect(partitionDismissed([active, dismissed])).toEqual({
      activeEvents: [active],
      dismissedEvents: [dismissed],
    });
  });

  it("prefers active events when both exist", () => {
    const active = makeEvent({ id: "a" });
    const dismissed = makeEvent({ id: "d", dismissed: true });
    expect(preferActiveEvents([active, dismissed])).toEqual([active]);
  });

  it("keeps dismissed events when a day only has dismissed ones", () => {
    const dismissed = makeEvent({ id: "d", dismissed: true });
    expect(preferActiveEvents([dismissed])).toEqual([dismissed]);
  });

  it("includes dismissed alongside active when showDismissed is on", () => {
    const active = makeEvent({ id: "a", dismissed: false, startTime: "2025-01-15T10:00:00Z" });
    const dismissed = makeEvent({
      id: "d",
      dismissed: true,
      startTime: "2025-01-15T09:00:00Z",
    });
    expect(preferActiveEvents([dismissed, active], { showDismissed: true }).map((e) => e.id)).toEqual([
      "a",
      "d",
    ]);
  });

  it("sorts active before dismissed while keeping startTime order within buckets", () => {
    const earlyDismissed = makeEvent({
      id: "d1",
      startTime: "2026-07-23T08:00:00Z",
      dismissed: true,
    });
    const lateActive = makeEvent({
      id: "a2",
      startTime: "2026-07-23T12:00:00Z",
    });
    const earlyActive = makeEvent({
      id: "a1",
      startTime: "2026-07-23T09:00:00Z",
    });
    expect(
      sortActiveThenDismissed([earlyDismissed, lateActive, earlyActive]).map((e) => e.id),
    ).toEqual(["a1", "a2", "d1"]);
  });
});
