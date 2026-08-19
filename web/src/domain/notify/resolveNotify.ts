import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { normalizeNotifyPref, type NotifyPref } from "./notifyPref";

export type ResolveNotifyInput = {
  /** Per-row override. Blank / omitted → inherit. */
  override?: string | null;
  /**
   * Workset default. ``null`` / omitted treats as on (schema default).
   * Unassigned rows (no workset) also default on.
   */
  worksetNotifyEnabled?: boolean | null;
  /** Notification-page master switch. Off mutes everything. */
  globalEnabled: boolean;
  /** Quiet hours / DND. Active DND mutes everything. */
  quietHoursActive?: boolean;
};

/**
 * Reminder gate: global / DND → entity checkbox → workset default.
 *
 * - global off or DND: never notify
 * - ``off``: this entity silent
 * - ``inherit``: use ``worksetNotifyEnabled`` (missing → on)
 * - HTTP ``"follow"`` / ``"on"`` are 422; read-side coerce treats them as unknown → default
 */
export function resolveNotify(input: ResolveNotifyInput): boolean {
  if (!input.globalEnabled) return false;
  if (input.quietHoursActive) return false;
  const override = normalizeNotifyPref(input.override);
  if (override === "off") return false;
  return input.worksetNotifyEnabled !== false;
}

export type NotifyWorksetLookup = ReadonlyMap<string, boolean>;

export type NotifyRowPrefs = {
  notifyPref?: NotifyPref | null;
  worksetId?: string | null;
};

export type NotifyTaskLookup = ReadonlyMap<string, NotifyRowPrefs>;

export type NotifySeriesLookup = ReadonlyMap<string, NotifyRowPrefs>;

export type NotifyEventInput = {
  kind?: "event" | "recurring" | "user";
  /** Analysis-task id, or recurring series id when ``kind === "recurring"``. */
  taskId?: string | null;
  worksetId?: string | null;
  notifyPref?: string | null;
};

/**
 * Resolve one timed row: analysis uses the task catalog; recurring uses the
 * series map; user / item_remind use the row's own pref + workset.
 */
export function resolveEventNotify(
  event: NotifyEventInput,
  ctx: {
    globalEnabled: boolean;
    quietHoursActive?: boolean;
    worksetNotifyById: NotifyWorksetLookup;
    tasksById?: NotifyTaskLookup;
    seriesById?: NotifySeriesLookup;
  },
): boolean {
  let override = event.notifyPref;
  let worksetId = event.worksetId?.trim() || null;

  if (event.kind === "recurring") {
    const seriesId = event.taskId?.trim() || "";
    const series = seriesId ? ctx.seriesById?.get(seriesId) : undefined;
    if (series) {
      override = series.notifyPref ?? override;
      worksetId = series.worksetId?.trim() || worksetId;
    }
  } else if (event.kind !== "user") {
    const taskId = event.taskId?.trim() || "";
    const task = taskId ? ctx.tasksById?.get(taskId) : undefined;
    if (task) {
      override = task.notifyPref ?? override;
      worksetId = task.worksetId?.trim() || worksetId;
    }
  }

  const resolvedWorkset = worksetId || SYSTEM_WORKSET_ID;
  const worksetNotifyEnabled = ctx.worksetNotifyById.get(resolvedWorkset) ?? true;

  return resolveNotify({
    override,
    worksetNotifyEnabled,
    globalEnabled: ctx.globalEnabled,
    quietHoursActive: ctx.quietHoursActive,
  });
}
