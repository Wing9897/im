/**
 * Shared SourceFilterDialog option mapping for Board widgets.
 */

import type { Workset } from "../types/worksets";
import { SYSTEM_WORKSET_ID } from "../types/worksets";
import { resolveSourceFilterTaskLabel } from "../domain/timeline/sourceFilterOptions";

export type BoardFilterTaskOption = {
  id: string;
  name: string;
  worksetId: string | null;
  analysisMode?: string | null;
};

export type BoardFilterWorksetOption = {
  id: string;
  name: string;
  isSystem: boolean;
  cover?: string;
};

/** Label builtin `__general__` with the localized「一般」name. */
export function boardSourceFilterWorksets(
  worksets: readonly Workset[],
  generalWorksetLabel: string,
): BoardFilterWorksetOption[] {
  return worksets.map((ws) => ({
    id: ws.id,
    name: ws.id === SYSTEM_WORKSET_ID ? generalWorksetLabel : ws.name,
    isSystem: ws.isSystem,
    cover: ws.cover ?? "",
  }));
}

export function boardSourceFilterExpandTasks(
  tasks: readonly {
    id: string;
    name: string;
    worksetId?: string | null;
    analysisMode?: string | null;
  }[],
): BoardFilterTaskOption[] {
  return tasks.map((task) => ({
    id: task.id,
    name: resolveSourceFilterTaskLabel(task.name, task.id),
    worksetId: task.worksetId ?? null,
    analysisMode: task.analysisMode ?? null,
  }));
}
