/**
 * Shared SourceFilterDialog option mapping for Board widgets.
 */

import type { Workset } from "../types/worksets";
import { SYSTEM_WORKSET_ID } from "../types/worksets";

export type BoardFilterTaskOption = {
  id: string;
  name: string;
  worksetId: string | null;
};

export type BoardFilterWorksetOption = {
  id: string;
  name: string;
  isSystem: boolean;
};

/** Label builtin `__user__` with the localized「一般」name. */
export function boardSourceFilterWorksets(
  worksets: readonly Workset[],
  generalWorksetLabel: string,
): BoardFilterWorksetOption[] {
  return worksets.map((ws) => ({
    id: ws.id,
    name: ws.id === SYSTEM_WORKSET_ID ? generalWorksetLabel : ws.name,
    isSystem: ws.isSystem,
  }));
}

export function boardSourceFilterExpandTasks(
  tasks: readonly { id: string; name: string; worksetId?: string | null }[],
): BoardFilterTaskOption[] {
  return tasks.map((task) => ({
    id: task.id,
    name: task.name,
    worksetId: task.worksetId ?? null,
  }));
}
