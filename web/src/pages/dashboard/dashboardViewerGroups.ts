import type { TFunction } from "i18next";

import type { AnalysisTask } from "../../types/tasks";
import type { Workset } from "../../types/worksets";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";

export type DashboardWorksetGroup = {
  key: string;
  title: string;
  isSystem: boolean;
  tasks: AnalysisTask[];
};

/** Group visible tasks under workset cards (by_workset view). */
export function buildDashboardWorksetGroups(opts: {
  visibleTasks: AnalysisTask[];
  worksets: Workset[];
  showSystemWorksets: boolean;
  t: TFunction;
}): DashboardWorksetGroup[] {
  const { visibleTasks, worksets, showSystemWorksets, t } = opts;
  const byId = new Map(worksets.map((ws) => [ws.id, ws]));
  const groups = new Map<string, DashboardWorksetGroup>();

  for (const ws of worksets) {
    const title = ws.id === SYSTEM_WORKSET_ID ? t("workset:generalName") : ws.name;
    groups.set(ws.id, {
      key: ws.id,
      title,
      isSystem: Boolean(ws.isSystem) || ws.id === SYSTEM_WORKSET_ID,
      tasks: [],
    });
  }

  for (const task of visibleTasks) {
    const key = task.worksetId ?? "__unassigned__";
    if (key === "__unassigned__") {
      const group = groups.get("__unassigned__") ?? {
        key: "__unassigned__",
        title: t("workset:unassignedGroup"),
        isSystem: false,
        tasks: [],
      };
      group.tasks.push(task);
      groups.set("__unassigned__", group);
      continue;
    }
    const existing = groups.get(key);
    if (existing) {
      existing.tasks.push(task);
    } else {
      const ws = byId.get(key);
      groups.set(key, {
        key,
        title: ws?.name ?? t("workset:unknownGroup"),
        isSystem: Boolean(ws?.isSystem),
        tasks: [task],
      });
    }
  }

  const ordered: DashboardWorksetGroup[] = [];
  for (const ws of worksets) {
    const group = groups.get(ws.id);
    if (!group) continue;
    if (!showSystemWorksets && group.isSystem) continue;
    ordered.push(group);
  }
  const unassigned = groups.get("__unassigned__");
  if (unassigned) ordered.push(unassigned);
  return ordered;
}
