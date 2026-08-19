/**
 * Shared lookup for task card emojis (`ui_prefs.task_emojis`).
 *
 * Store shape: `{ emojis: { "<taskId>": "🎯" } }`.
 * Empty / missing key → default product task logo (not the AI head).
 * Timeline analysis / recurring rows look up via `event.taskId`.
 */

import { SYSTEM_WORKSET_ID } from "../../types/worksets";

export function lookupTaskEmoji(
  emojis: Readonly<Record<string, string>>,
  taskId: string | null | undefined,
): string {
  const id = (taskId ?? "").trim();
  if (!id || id === SYSTEM_WORKSET_ID) return "";
  const glyph = emojis[id];
  return typeof glyph === "string" ? glyph.trim() : "";
}

export type TaskEmojiEventRef = {
  taskId?: string | null;
};

export function lookupTaskEmojiForEvent(
  emojis: Readonly<Record<string, string>>,
  event: TaskEmojiEventRef,
): string {
  return lookupTaskEmoji(emojis, event.taskId);
}
