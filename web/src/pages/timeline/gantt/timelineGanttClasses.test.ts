import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  ganttColumnHeaderClass,
  ganttColumnHeaderTextClass,
  ganttDayCellClass,
  ganttEventNameClass,
  ganttEventRowClass,
  ganttHeaderLabelClass,
  ganttLeftColumnClass,
  ganttLegendLabelClass,
  ganttRootClass,
  ganttTimeAxisGridClass,
} from "./timelineGanttClasses";

const here = dirname(fileURLToPath(import.meta.url));
const timelineCss = readFileSync(resolve(here, "../../../css/timeline-page.css"), "utf8");

describe("gantt contrast classes", () => {
  it("keeps a local gantt root hook for chart-only overlay", () => {
    expect(ganttRootClass).toContain("im-timeline-gantt");
    expect(ganttRootClass).not.toContain("bg-surface-card");
  });

  it("brightens axis, event-column header, and legend ink", () => {
    expect(ganttColumnHeaderTextClass).toContain("text-text-secondary");
    expect(ganttColumnHeaderTextClass).not.toContain("text-text-muted");
    expect(ganttColumnHeaderClass(false)).toContain("text-text-secondary");
    expect(ganttHeaderLabelClass).toContain("text-text-secondary");
    expect(ganttHeaderLabelClass).not.toContain("text-text-muted");
    expect(ganttLegendLabelClass).toContain("var(--text-primary)");
    expect(ganttEventNameClass(false)).toContain("text-text-primary");
  });

  it("strengthens hour grid and row tracks without restyling status bars", () => {
    expect(ganttDayCellClass(false)).toMatch(/--surface-border\)_55%/);
    expect(ganttEventRowClass(false)).toMatch(/--surface-border\)_52%/);
    expect(ganttLeftColumnClass).toMatch(/--surface-border\)_58%/);
    expect(ganttTimeAxisGridClass).toContain("var(--surface-card)");
  });
});

describe("gantt photo-BG overlay contract", () => {
  it("remaps muted/secondary locally and densifies the chart over wallpaper", () => {
    expect(timelineCss).toMatch(
      /\.im-timeline-gantt\s*\{[^}]*--text-muted:\s*color-mix\(in srgb, var\(--text-primary\) 72%/s,
    );
    expect(timelineCss).toMatch(
      /\.im-timeline-gantt\s*\{[^}]*--text-secondary:\s*color-mix\(in srgb, var\(--text-primary\) 84%/s,
    );
    expect(timelineCss).toMatch(
      /html\[data-theme-bg="custom"\] \.im-timeline-gantt,\s*html\[data-theme-bg="focal"\] \.im-timeline-gantt\s*\{[^}]*--surface-card\) 86%/s,
    );
    expect(timelineCss).not.toMatch(/\.im-page-canvas[\s\S]{0,80}--theme-bg-image:\s*none/);
  });
});
