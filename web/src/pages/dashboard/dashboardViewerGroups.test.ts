import { describe, expect, it } from "vitest";

import type { AnalysisTask } from "../../types/tasks";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { buildDashboardWorksetGroups } from "./dashboardViewerGroups";

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
  it("orders by workset catalog and appends unassigned", () => {
    const groups = buildDashboardWorksetGroups({
      visibleTasks: [
        task({ id: "t1", name: "A", worksetId: "ws-2" }),
        task({ id: "t2", name: "B", worksetId: null }),
        task({ id: "t3", name: "C", worksetId: SYSTEM_WORKSET_ID }),
      ],
      worksets: [
        {
          id: SYSTEM_WORKSET_ID,
          name: "General",
          isSystem: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "ws-2",
          name: "Alpha",
          isSystem: false,
          createdAt: "",
          updatedAt: "",
        },
      ],
      showSystemWorksets: true,
      t,
    });

    expect(groups.map((g) => g.key)).toEqual([
      SYSTEM_WORKSET_ID,
      "ws-2",
      "__unassigned__",
    ]);
    expect(groups[0].tasks.map((row) => row.id)).toEqual(["t3"]);
    expect(groups[1].tasks.map((row) => row.id)).toEqual(["t1"]);
    expect(groups[2].tasks.map((row) => row.id)).toEqual(["t2"]);
  });

  it("hides system worksets when toggled off", () => {
    const groups = buildDashboardWorksetGroups({
      visibleTasks: [task({ id: "t1", name: "A", worksetId: SYSTEM_WORKSET_ID })],
      worksets: [
        {
          id: SYSTEM_WORKSET_ID,
          name: "General",
          isSystem: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
      showSystemWorksets: false,
      t,
    });
    expect(groups).toEqual([]);
  });
});
