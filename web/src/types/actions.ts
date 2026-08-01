// ============================================================
// Action Type Definitions
// ============================================================

import type { components } from "../api/generated/schema";

type ActionResponse = components["schemas"]["ActionResponse"];

/** Action type discriminator */
export type ActionType = ActionResponse["actionType"];

/** Telegram Bot configuration */
export interface TelegramBotConfig {
  bot_token: string;
  chat_id: string;
}

/** Discord Webhook configuration */
export interface DiscordWebhookConfig {
  webhook_url: string;
}

/** HTTP Webhook configuration */
export interface HttpWebhookConfig {
  url: string;
  method: "POST" | "PUT";
  headers: Record<string, string>;
  include_raw_data: boolean;
}

/** MQTT configuration */
export interface MqttConfig {
  broker_url: string;
  topic: string;
  username: string;
  password: string;
  qos: 0 | 1 | 2;
}

/** Trigger conditions for an action */
export interface TriggerConditions {
  score_threshold?: number;
  task_id?: string;
}

/** A configured action */
export type Action = ActionResponse;

/** Result from POST /api/v1/actions/{id}/test */
export type TestActionResult = components["schemas"]["ActionTestResponse"];

/** A single action trigger history row */
export type ActionTriggerHistoryEntry =
  components["schemas"]["ActionTriggerHistoryEntryResponse"];

/** Paginated trigger history response */
export type ActionTriggerHistoryPage =
  components["schemas"]["ActionTriggerHistoryPageResponse"];
