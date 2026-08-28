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

/** Group visible tasks under workset cards. Builtin「一般」 is always included. */
export function buildDashboardWorksetGroups(opts: {
  visibleTasks: AnalysisTask[];
  worksets: Workset[];
  t: TFunction;
}): DashboardWorksetGroup[] {
  const { visibleTasks, worksets, t } = opts;
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
    const key = task.worksetId?.trim() || SYSTEM_WORKSET_ID;
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
    ordered.push(group);
  }
  return ordered;
}

/** Client-side filter of workset cards by display name. */
export function filterWorksetGroupsByName(
  groups: readonly DashboardWorksetGroup[],
  query: string,
): DashboardWorksetGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...groups];
  return groups.filter((group) => group.title.toLowerCase().includes(q));
}

/** Board widgets: catalog-ordered groups that contain at least one task. */
export function buildBoardWorksetGroups(opts: {
  visibleTasks: AnalysisTask[];
  worksets: Workset[];
  t: TFunction;
}): DashboardWorksetGroup[] {
  return buildDashboardWorksetGroups(opts).filter((group) => group.tasks.length > 0);
}
