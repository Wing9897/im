/**
 * REST client for schedule card emojis (ui_prefs ``schedule_emojis``).
 */

import { apiClient } from "../client";
import type { components } from "../generated/schema";

export type ScheduleEmojisResponse = components["schemas"]["ScheduleEmojisResponse"];
export type ScheduleEmojisPutBody = components["schemas"]["ScheduleEmojisPutBody"];

const SCHEDULE_EMOJIS_PATH = "/api/v1/ui-prefs/schedule/emojis";

export function fetchScheduleEmojis(): Promise<ScheduleEmojisResponse> {
  return apiClient.get<ScheduleEmojisResponse>(SCHEDULE_EMOJIS_PATH);
}

export function putScheduleEmojis(body: ScheduleEmojisPutBody): Promise<ScheduleEmojisResponse> {
  return apiClient.put<ScheduleEmojisResponse>(SCHEDULE_EMOJIS_PATH, body);
}
