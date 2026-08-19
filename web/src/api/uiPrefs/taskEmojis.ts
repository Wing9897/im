/**
 * REST client for task card emojis (ui_prefs ``task_emojis``).
 *
 * Keys are analysis task ids. Empty glyph omitted. Stamp 42 has no emoji column —
 * this is the same unification as ``schedule_emojis``.
 */

import { apiClient } from "../client";
import type { components } from "../generated/schema";

export type TaskEmojisResponse = components["schemas"]["TaskEmojisResponse"];
export type TaskEmojisPutBody = components["schemas"]["TaskEmojisPutBody"];

const TASK_EMOJIS_PATH = "/api/v1/ui-prefs/tasks/emojis";

export function fetchTaskEmojis(): Promise<TaskEmojisResponse> {
  return apiClient.get<TaskEmojisResponse>(TASK_EMOJIS_PATH);
}

export function putTaskEmojis(body: TaskEmojisPutBody): Promise<TaskEmojisResponse> {
  return apiClient.put<TaskEmojisResponse>(TASK_EMOJIS_PATH, body);
}
