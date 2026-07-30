import i18n from "../../i18n";

export type SourceFilterOption = {
  id: string;
  name: string;
};

function unnamedTaskLabel(): string {
  return String(i18n.t("board.common.unnamedTask"));
}

type CatalogTask = { id: string; name: string };
type EventTaskHint = { taskId?: string | null; taskName?: string | null };

/**
 * Prefer catalog tasks for the filter checklist; fall back to distinct
 * task ids seen on loaded events when the catalog is empty.
 *
 * Does not inject a virtual `__user__` row — callers pass worksets
 * (incl. the builtin system workset) separately.
 */
export function catalogOrEventSourceOptions(
  tasks: readonly CatalogTask[],
  events: readonly EventTaskHint[] | null | undefined,
): SourceFilterOption[] {
  if (tasks.length > 0) {
    return tasks.map((task) => ({ id: task.id, name: task.name.trim() || unnamedTaskLabel() }));
  }
  const seen = new Map<string, string>();
  for (const event of events ?? []) {
    if (event.taskId && !seen.has(event.taskId)) {
      seen.set(event.taskId, (event.taskName || "").trim() || unnamedTaskLabel());
    }
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name }));
}
