import { describe, expect, it } from "vitest";
import type { Workset } from "../types/worksets";
import {
  boardSourceFilterExpandTasks,
  boardSourceFilterWorksets,
} from "./boardSourceFilterOptions";

describe("boardSourceFilterOptions", () => {
  it("uses the localized general label without mutating other worksets", () => {
    const worksets = [
      { id: "__general__", name: "General", isSystem: true },
      { id: "ws-1", name: "Operations", isSystem: false },
    ] as Workset[];

    expect(boardSourceFilterWorksets(worksets, "一般")).toEqual([
      { id: "__general__", name: "一般", isSystem: true },
      { id: "ws-1", name: "Operations", isSystem: false },
    ]);
  });

  it("normalizes missing task workset ids to null and keeps analysisMode", () => {
    expect(
      boardSourceFilterExpandTasks([
        { id: "task-1", name: "One" },
        { id: "task-2", name: "Two", worksetId: "ws-1", analysisMode: "agent" },
        { id: "task-3", name: "Web", worksetId: "ws-1", analysisMode: "agent" },
      ]),
    ).toEqual([
      { id: "task-1", name: "One", worksetId: null, analysisMode: null },
      { id: "task-2", name: "Two", worksetId: "ws-1", analysisMode: "agent" },
      { id: "task-3", name: "Web", worksetId: "ws-1", analysisMode: "agent" },
    ]);
  });

  it("labels blank hex task names via resolveSourceFilterTaskLabel", () => {
    expect(
      boardSourceFilterExpandTasks([
        { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", name: "  " },
      ])[0]?.name,
    ).toMatch(/aaaaaaaa/);
  });
});
