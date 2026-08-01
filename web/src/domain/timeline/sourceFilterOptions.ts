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
 * Human-readable label for a source-filter task row.
 * Never uses a full hex/opaque id as the primary label.
 */
export function resolveSourceFilterTaskLabel(
  name: string | undefined | null,
  id: string,
  unnamedLabel: string = unnamedTaskLabel(),
): string {
  const trimmed = (name ?? "").trim();
  if (trimmed) return trimmed;
  const compactId = id.trim();
  if (!compactId) return unnamedLabel;
  // Opaque ids (hex hashes, UUIDs without dashes, long tokens) → short suffix.
  if (/^[0-9a-f]{16,}$/i.test(compactId) || compactId.length > 20) {
    return `${unnamedLabel} (${compactId.slice(0, 8)}…)`;
  }
  return unnamedLabel;
}

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
    return tasks.map((task) => ({
      id: task.id,
      name: resolveSourceFilterTaskLabel(task.name, task.id),
    }));
  }
  const seen = new Map<string, string>();
  for (const event of events ?? []) {
    if (event.taskId && !seen.has(event.taskId)) {
      seen.set(
        event.taskId,
        resolveSourceFilterTaskLabel(event.taskName, event.taskId),
      );
    }
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name }));
}
