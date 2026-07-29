import {
  USER_EVENTS_FILTER_ID,
  getUserEventsFilterLabel,
} from "./userEvents";
import i18n from "../../i18n";

export type TaskFilterOption = {
  id: string;
  name: string;
};

function unnamedTaskLabel(): string {
  return String(i18n.t("board.common.unnamedTask"));
}

/** Ensure the virtual user/assistant row is present once in a filter checklist. */
export function withUserEventsFilterOption(
  options: readonly TaskFilterOption[],
  userEventsLabel?: string,
): TaskFilterOption[] {
  if (options.some((option) => option.id === USER_EVENTS_FILTER_ID)) {
    return [...options];
  }
  const name = userEventsLabel ?? getUserEventsFilterLabel();
  return [...options, { id: USER_EVENTS_FILTER_ID, name }];
}

type CatalogTask = { id: string; name: string };
type EventTaskHint = { taskId?: string | null; taskName?: string | null };

/**
 * Prefer catalog tasks for the filter checklist; fall back to distinct
 * task ids seen on loaded events when the catalog is empty.
 */
export function catalogOrEventFilterOptions(
  tasks: readonly CatalogTask[],
  events: readonly EventTaskHint[] | null | undefined,
  userEventsLabel?: string,
): TaskFilterOption[] {
  if (tasks.length > 0) {
    return withUserEventsFilterOption(
      tasks.map((task) => ({ id: task.id, name: task.name.trim() || unnamedTaskLabel() })),
      userEventsLabel,
    );
  }
  const seen = new Map<string, string>();
  for (const event of events ?? []) {
    if (event.taskId && !seen.has(event.taskId)) {
      seen.set(event.taskId, (event.taskName || "").trim() || unnamedTaskLabel());
    }
  }
  return withUserEventsFilterOption(
    [...seen.entries()].map(([id, name]) => ({ id, name })),
    userEventsLabel,
  );
}
