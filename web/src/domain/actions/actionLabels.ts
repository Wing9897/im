import type { Action, ActionType } from "../../types";
import { joinList } from "../../i18n/formatMessage";
import { parseTriggerConditions } from "./parseTriggerConditions";

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  telegram_bot: "Telegram Bot",
  discord_webhook: "Discord Webhook",
  http_webhook: "HTTP Webhook",
  mqtt: "MQTT",
};

type TriggerSummaryTranslate = (
  key: "scoreThreshold" | "specificTask" | "allAnalysis",
  options?: Record<string, unknown>,
) => string;

/**
 * Shared trigger-conditions one-liner for action cards / detail views.
 * Callers supply a translator that resolves the short keys (with `{id}`
 * for `specificTask` / `{value}` for `scoreThreshold`).
 */
export function formatTriggerSummary(
  action: Action,
  t: TriggerSummaryTranslate,
): string {
  const tc = parseTriggerConditions(action.triggerConditions);
  const parts: string[] = [];
  if (tc.score_threshold != null) {
    parts.push(t("scoreThreshold", { value: tc.score_threshold }));
  }
  if (tc.task_id) {
    parts.push(t("specificTask", { id: tc.task_id }));
  }
  return parts.length > 0 ? joinList(parts) : t("allAnalysis");
}
