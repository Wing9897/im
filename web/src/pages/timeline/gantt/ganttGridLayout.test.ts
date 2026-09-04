import { describe, expect, it } from "vitest";

import {
  GANTT_AXIS_FOLLOW_GAP_CLASS,
  GANTT_AXIS_HEIGHT_CLASS,
  GANTT_LANE_HEIGHT_CLASS,
  GANTT_LANE_HEIGHT_REM,
  ganttOverviewGridTemplateRows,
} from "./ganttGridLayout";
import {
  ganttEventNameClass,
  ganttEventRowClass,
  ganttHeaderLabelClass,
  ganttOverviewAxisClass,
  ganttOverviewTrackRowClass,
  ganttTimeAxisGridClass,
} from "./timelineGanttClasses";

describe("ganttOverviewGridTemplateRows", () => {
  it("keeps a single auto axis row when there are no lanes", () => {
    expect(ganttOverviewGridTemplateRows(0)).toBe("auto");
    expect(ganttOverviewGridTemplateRows(-1)).toBe("auto");
  });

  it("locks each event lane to the shared h-7 track", () => {
    expect(ganttOverviewGridTemplateRows(3)).toBe(
      `auto repeat(3, minmax(${GANTT_LANE_HEIGHT_REM}rem, auto))`,
    );
  });
});

describe("gantt vertical geometry contract", () => {
  it("uses the same axis height and follow-gap on labels, discrete, and 全局", () => {
    for (const className of [
      ganttHeaderLabelClass,
      ganttTimeAxisGridClass,
      ganttOverviewAxisClass,
    ]) {
      expect(className).toContain(GANTT_AXIS_HEIGHT_CLASS);
      expect(className).toContain(GANTT_AXIS_FOLLOW_GAP_CLASS);
      expect(className).not.toContain("mb-2");
    }
  });

  it("uses the same locked lane height on labels and both chart row shells", () => {
    for (const className of [
      ganttEventNameClass(false),
      ganttEventRowClass(false),
      ganttOverviewTrackRowClass(false),
    ]) {
      expect(className).toContain(GANTT_LANE_HEIGHT_CLASS);
    }
  });
});
