import { beforeEach, describe, expect, it } from "vitest";

import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import { isWeekendDay, truncateMonthEventTitle } from "./calendar/timelineCalendarClasses";
import {
  GANTT_COLUMN_WIDTH_PX,
  ganttColumnGap,
  ganttGridTemplateColumns,
  ganttTimelineMinWidth,
} from "./gantt/ganttGridLayout";
import { resolveTimelineEmptyHint } from "./timelineViewModel";

describe("timelineCalendarClasses helpers", () => {
  it("truncates long event titles for month preview", () => {
    expect(truncateMonthEventTitle("Short")).toBe("Short");
    expect(truncateMonthEventTitle("A very long event title here")).toBe("A very lo…");
  });

  it("detects weekend days", () => {
    expect(isWeekendDay(new Date(2026, 6, 11))).toBe(true); // Saturday
    expect(isWeekendDay(new Date(2026, 6, 12))).toBe(true); // Sunday
    expect(isWeekendDay(new Date(2026, 6, 13))).toBe(false); // Monday
  });
});

describe("ganttGridLayout", () => {
  it("uses flexible columns for month/week/day so the full period fits without x scroll", () => {
    expect(ganttGridTemplateColumns(31, false)).toBe("repeat(31, minmax(0, 1fr))");
    expect(ganttTimelineMinWidth(31, false)).toBeUndefined();
  });

  it("uses fixed pixel columns with min width for quarter/year scroll mode", () => {
    expect(ganttGridTemplateColumns(13, true)).toBe(`repeat(13, ${GANTT_COLUMN_WIDTH_PX}px)`);
    expect(ganttTimelineMinWidth(13, true)).toBe(
      13 * GANTT_COLUMN_WIDTH_PX + 12 * ganttColumnGap(true),
    );
  });
});

describe("resolveTimelineEmptyHint", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("stays quiet when there are no events (no top banner)", () => {
    expect(resolveTimelineEmptyHint([], [], "尚無 timeline 任務")).toBeNull();
  });

  it("returns filter copy when events exist but none match filters", () => {
    const hint = resolveTimelineEmptyHint([{ id: "1" } as never], [], "ignored");
    expect(hint?.title).toBe(i18n.t("timeline:empty.filteredTitle"));
  });

  it("returns null when visible events exist", () => {
    const event = { id: "1" } as never;
    expect(resolveTimelineEmptyHint([event], [event], "ignored")).toBeNull();
  });
});
