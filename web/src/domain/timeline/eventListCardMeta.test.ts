import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import { makeTimelineItem } from "../../test/analysisEventFixtures";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  calendarLocationDisplay,
  eventListCardTitle,
  eventShowsRemindBadge,
  resolveEventCardDisplay,
  resolveEventListDayPhaseTag,
  resolveEventListProvenanceKind,
  resolveEventListWorksetName,
} from "./eventListCardMeta";
import { IMPORTANT_EVENT_EMOJI } from "../../api/timelineImportance";

describe("eventListCardMeta", () => {
  beforeEach(async () => {
    await setAppLocale("zh-Hant");
  });

  it("resolves workset from worksetId with general fallback", () => {
    expect(
      resolveEventListWorksetName(
        makeTimelineItem({ worksetId: SYSTEM_WORKSET_ID }),
        { generalWorksetLabel: "一般" },
      ),
    ).toBe("一般");
    expect(
      resolveEventListWorksetName(
        makeTimelineItem({ worksetId: "ws-ops" }),
        {
          generalWorksetLabel: "一般",
          worksetNameById: new Map([["ws-ops", "營運"]]),
        },
      ),
    ).toBe("營運");
    expect(
      resolveEventListWorksetName(makeTimelineItem({}), {
        generalWorksetLabel: "一般",
      }),
    ).toBe("一般");
  });

  it("resolves provenance kinds per source/origin", () => {
    expect(
      resolveEventListProvenanceKind(
        makeTimelineItem({ source: "item", itemDateKind: "remind" }),
      ),
    ).toBe("item");
    expect(
      resolveEventListProvenanceKind(
        makeTimelineItem({ source: "user", origin: "assistant" }),
      ),
    ).toBe("assistant");
    expect(
      resolveEventListProvenanceKind(
        makeTimelineItem({ source: "user", origin: "manual" }),
      ),
    ).toBe("user");
    expect(
      resolveEventListProvenanceKind(
        makeTimelineItem({ source: "analysis", taskName: "Ops" }),
      ),
    ).toBe("task");
    expect(
      resolveEventListProvenanceKind(
        makeTimelineItem({ source: "recurring", taskName: "週會" }),
      ),
    ).toBe("task");
  });

  it("maps spanning cover to 跨日进行中; ending uses 本日* when focused is today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 8, 12, 0, 0));
    const spanning = makeTimelineItem({
      startTime: new Date(2026, 7, 6, 9, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 10, 18, 0, 0).toISOString(),
    });
    expect(resolveEventListDayPhaseTag(spanning, new Date(2026, 7, 8))).toBe(
      "ongoingMultiDay",
    );
    expect(resolveEventListDayPhaseTag(spanning, new Date(2026, 7, 10))).toBe(
      "endingFocused",
    );
    expect(resolveEventListDayPhaseTag(spanning, new Date(2026, 7, 6))).toBeNull();

    const last = makeTimelineItem({
      source: "recurring",
      isLastOccurrence: true,
      startTime: new Date(2026, 7, 8, 9, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 8, 10, 0, 0).toISOString(),
    });
    expect(resolveEventListDayPhaseTag(last, new Date(2026, 7, 8))).toBe(
      "endingToday",
    );
    vi.useRealTimers();
  });

  it("uses unified 跨日进行中 + 结束于当日 when viewing a non-today day (Aug 6 now → Aug 8)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 6, 12, 0, 0));
    const trip = makeTimelineItem({
      title: "三日出差",
      startTime: new Date(2026, 7, 7, 9, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 9, 18, 0, 0).toISOString(),
    });
    // Middle day of trip while viewing Aug 8 ≠ today → 跨日进行中
    expect(resolveEventListDayPhaseTag(trip, new Date(2026, 7, 8))).toBe(
      "ongoingMultiDay",
    );
    // End day of overnight while viewing Aug 8 ≠ today → 结束于当日
    const overnight = makeTimelineItem({
      startTime: new Date(2026, 7, 7, 8, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 8, 8, 0, 0).toISOString(),
    });
    expect(resolveEventListDayPhaseTag(overnight, new Date(2026, 7, 8))).toBe(
      "endingFocused",
    );
    // Covering middle day still 跨日进行中 whether or not event also covers real today
    const coveringTodayAndFocused = makeTimelineItem({
      startTime: new Date(2026, 7, 5, 9, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 10, 18, 0, 0).toISOString(),
    });
    expect(
      resolveEventListDayPhaseTag(coveringTodayAndFocused, new Date(2026, 7, 8)),
    ).toBe("ongoingMultiDay");
    vi.useRealTimers();
  });

  it("uses localized general label via i18n when lookups omit it", () => {
    expect(String(i18n.t("common:workset.generalName"))).toBe("一般");
    expect(
      resolveEventListWorksetName(
        makeTimelineItem({ worksetId: SYSTEM_WORKSET_ID }),
      ),
    ).toBe("一般");
  });

  it("shows unified remind badge for item remind + user remindBeforeDays", () => {
    expect(
      eventShowsRemindBadge(
        makeTimelineItem({ source: "item", itemDateKind: "remind" }),
      ),
    ).toBe(true);
    expect(
      eventShowsRemindBadge(
        makeTimelineItem({ source: "item", itemDateKind: undefined }),
      ),
    ).toBe(false);

    expect(
      eventShowsRemindBadge(
        makeTimelineItem({
          source: "user",
          origin: "manual",
          remindBeforeDays: 1,
        }),
      ),
    ).toBe(true);
    expect(
      eventShowsRemindBadge(
        makeTimelineItem({
          source: "user",
          origin: "assistant",
          remindBeforeDays: 0,
        }),
      ),
    ).toBe(true);
    expect(
      eventShowsRemindBadge(
        makeTimelineItem({
          source: "user",
          origin: "manual",
          remindBeforeDays: null,
        }),
      ),
    ).toBe(false);
    expect(
      eventShowsRemindBadge(
        makeTimelineItem({ source: "user", origin: "assistant" }),
      ),
    ).toBe(false);

    expect(
      eventShowsRemindBadge(
        makeTimelineItem({ source: "analysis", remindBeforeDays: 3 }),
      ),
    ).toBe(true);
    expect(
      eventShowsRemindBadge(makeTimelineItem({ source: "analysis" })),
    ).toBe(false);
  });

  it("suppresses remind title prefix when remind badge is shown", () => {
    expect(
      eventListCardTitle(
        makeTimelineItem({
          title: "提醒 · milk",
          source: "item",
          itemDateKind: "remind",
        }),
        { showRemindBadge: true },
      ),
    ).toBe("milk");
    expect(
      eventListCardTitle(
        makeTimelineItem({
          title: "milk",
          source: "item",
          itemDateKind: undefined,
        }),
        { showRemindBadge: false },
      ),
    ).toBe("milk");
    expect(
      eventListCardTitle(
        makeTimelineItem({
          title: "提醒 · milk",
          source: "item",
          itemDateKind: "remind",
        }),
        { showRemindBadge: false },
      ),
    ).toBe("提醒 · milk");
  });

  it("calendarLocationDisplay normalizes empty / N/A placeholders", () => {
    expect(calendarLocationDisplay(null)).toBe("N/A");
    expect(calendarLocationDisplay("  ")).toBe("N/A");
    expect(calendarLocationDisplay("n/a")).toBe("N/A");
    expect(calendarLocationDisplay(" Taipei ")).toBe("Taipei");
  });

  it("resolveEventCardDisplay bundles glyph, remind, phase tag, and title", () => {
    const focused = new Date(2025, 7, 6);
    const trip = makeTimelineItem({
      title: "Trip",
      isAllDay: true,
      startTime: "2025-08-05T00:00:00",
      endTime: "2025-08-08T23:59:59",
    });
    const mid = resolveEventCardDisplay(trip, focused, focused);
    expect(mid.dayPhaseTag).toBe("ongoingMultiDay");
    expect(mid.showRemindBadge).toBe(false);
    expect(mid.leading).toBeNull();
    expect(mid.title).toBe("Trip");

    const importantRemind = makeTimelineItem({
      title: "提醒 · milk",
      source: "item",
      itemDateKind: "remind",
      important: true,
      isAllDay: true,
      startTime: "2025-08-06T00:00:00",
      endTime: "2025-08-06T23:59:59",
    });
    const chrome = resolveEventCardDisplay(importantRemind, focused, focused);
    expect(chrome.leading).toEqual({
      type: "important",
      emoji: IMPORTANT_EVENT_EMOJI,
    });
    expect(chrome.showRemindBadge).toBe(true);
    expect(chrome.title).toBe("milk");
  });
});
