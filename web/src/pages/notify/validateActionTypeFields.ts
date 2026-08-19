import type { ValidationResult } from "../../types";
import {
  validateDiscordConfig,
  validateHttpConfig,
  validateMqttConfig,
  validateTelegramConfig,
} from "../../utils/configValidation";
import type { ActionFormState } from "./form/useActionFormDialog";

export function validateActionTypeFields(form: ActionFormState): ValidationResult {
  switch (form.actionType) {
    case "telegram_bot":
      return validateTelegramConfig({ bot_token: form.botToken, chat_id: form.chatId });
    case "discord_webhook":
      return validateDiscordConfig({ webhook_url: form.discordWebhookUrl });
    case "http_webhook":
      return validateHttpConfig({ url: form.httpUrl, method: form.httpMethod });
    case "mqtt":
      return validateMqttConfig({
        broker_url: form.mqttBrokerUrl,
        topic: form.mqttTopic,
        username: form.mqttUsername,
        password: form.mqttPassword,
        qos: form.mqttQos,
      });
    default:
      return { valid: true, errors: {} };
  }
}
