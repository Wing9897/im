// ============================================================
// Action Type Definitions
// ============================================================

import type { components } from "../api/generated/schema";

type ActionResponse = components["schemas"]["ActionResponse"];

/** Action type discriminator */
export type ActionType = ActionResponse["actionType"];

// Embedded-JSON config shapes (OpenAPI components, snake_case = stored JSON):
// SoT is server/api/schemas/action_configs.py; the wire carries them inside
// the `configuration` / `triggerConditions` string fields. Build/validate
// lives in `domain/actions/`; untrusted parse stays in
// `pages/notify/actionConfigParsers.ts`.

/** Telegram Bot configuration */
export type TelegramBotConfig = components["schemas"]["TelegramBotConfig"];

/** Discord Webhook configuration */
export type DiscordWebhookConfig = components["schemas"]["DiscordWebhookConfig"];

/** HTTP Webhook configuration */
export type HttpWebhookConfig = components["schemas"]["HttpWebhookConfig"];

/** MQTT configuration */
export type MqttConfig = components["schemas"]["MqttConfig"];

/** Trigger conditions for an action */
export type TriggerConditions = components["schemas"]["ActionTriggerConditions"];

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
