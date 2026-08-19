/**
 * Action type-specific facade. Implementation is split by parsing, building,
 * and validation concerns to keep form consumers on a stable public API.
 */
import type { ActionType } from "../../../types";
import type { ActionFormState, HeaderEntry } from "../form/useActionFormDialog";
import { formStateFromAction as parseFormStateFromAction } from "../actionConfigParsers";

export { buildConfiguration } from "../actionConfiguration";
export { validateActionTypeFields } from "../validateActionTypeFields";

let headerIdCounter = 0;
export function nextHeaderId(): string {
  return `hdr_${++headerIdCounter}`;
}

const actionTypeDefaults = {
  telegram_bot: { botToken: "", chatId: "" },
  discord_webhook: { discordWebhookUrl: "" },
  http_webhook: {
    httpUrl: "",
    httpMethod: "POST" as const,
    httpHeaders: [{ id: nextHeaderId(), key: "", value: "" }] as HeaderEntry[],
    httpIncludeRawData: false,
  },
  mqtt: { mqttBrokerUrl: "", mqttTopic: "", mqttUsername: "", mqttPassword: "", mqttQos: 0 as const },
};

export function applyActionTypeSwitch(
  prev: ActionFormState,
  newType: ActionType,
): ActionFormState {
  if (prev.actionType === newType) return prev;
  return {
    ...prev,
    ...actionTypeDefaults.telegram_bot,
    ...actionTypeDefaults.discord_webhook,
    ...actionTypeDefaults.http_webhook,
    ...actionTypeDefaults.mqtt,
    actionType: newType,
  };
}

export function formStateFromAction(
  action: Parameters<typeof parseFormStateFromAction>[0],
  emptyFormState: ActionFormState,
): ActionFormState {
  return parseFormStateFromAction(action, emptyFormState, nextHeaderId);
}
