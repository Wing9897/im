import { describe, expect, it } from "vitest";

import type { AnalysisTask } from "../../types/tasks";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  buildDashboardWorksetGroups,
  filterWorksetGroupsByName,
} from "./dashboardViewerGroups";

const t = ((key: string) => key) as import("i18next").TFunction;

function task(partial: Partial<AnalysisTask> & { id: string; name: string }): AnalysisTask {
  return {
    worksetId: SYSTEM_WORKSET_ID,
    description: null,
    isActive: true,
    analysisMode: "message_batch",
    createdAt: "",
    updatedAt: "",
    ...partial,
  } as AnalysisTask;
}

describe("buildDashboardWorksetGroups", () => {
  it("orders by workset catalog and puts missing worksetId on 一般", () => {
    const groups = buildDashboardWorksetGroups({
      visibleTasks: [
        task({ id: "t1", name: "A", worksetId: "ws-2" }),
        task({ id: "t2", name: "B", worksetId: "" }),
        task({ id: "t3", name: "C", worksetId: SYSTEM_WORKSET_ID }),
      ],
      worksets: [
        {
          id: SYSTEM_WORKSET_ID,
          name: "General",
          isSystem: true,
          notifyEnabled: true,
          externalEnabled: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "ws-2",
          name: "Alpha",
          isSystem: false,
          notifyEnabled: true,
          externalEnabled: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
      t,
    });

    expect(groups.map((g) => g.key)).toEqual([SYSTEM_WORKSET_ID, "ws-2"]);
    expect(groups[0].tasks.map((row) => row.id)).toEqual(["t2", "t3"]);
    expect(groups[1].tasks.map((row) => row.id)).toEqual(["t1"]);
  });

  it("always includes builtin General even when it has no tasks", () => {
    const groups = buildDashboardWorksetGroups({
      visibleTasks: [],
      worksets: [
        {
          id: SYSTEM_WORKSET_ID,
          name: "General",
          isSystem: true,
          notifyEnabled: true,
          externalEnabled: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
      t,
    });
    expect(groups.map((g) => g.key)).toEqual([SYSTEM_WORKSET_ID]);
    expect(groups[0].isSystem).toBe(true);
  });
});

describe("filterWorksetGroupsByName", () => {
  const groups = [
    { key: SYSTEM_WORKSET_ID, title: "一般", isSystem: true, tasks: [] },
    { key: "ws-1", title: "Ops", isSystem: false, tasks: [] },
  ];

  it("returns all groups when the query is blank", () => {
    expect(filterWorksetGroupsByName(groups, "  ")).toEqual(groups);
  });

  it("filters by display name without hiding General unless it misses", () => {
    expect(filterWorksetGroupsByName(groups, "ops").map((g) => g.key)).toEqual(["ws-1"]);
    expect(filterWorksetGroupsByName(groups, "一般").map((g) => g.key)).toEqual([
      SYSTEM_WORKSET_ID,
    ]);
  });
});
