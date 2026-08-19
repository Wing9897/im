import type { ActionFormState } from "./form/useActionFormDialog";

export function buildConfiguration(form: ActionFormState): string {
  switch (form.actionType) {
    case "telegram_bot":
      return JSON.stringify({ bot_token: form.botToken.trim(), chat_id: form.chatId.trim() });
    case "discord_webhook":
      return JSON.stringify({ webhook_url: form.discordWebhookUrl.trim() });
    case "http_webhook": {
      const headers: Record<string, string> = {};
      for (const entry of form.httpHeaders) {
        const key = entry.key.trim();
        if (key) headers[key] = entry.value.trim();
      }
      return JSON.stringify({
        url: form.httpUrl.trim(),
        method: form.httpMethod,
        headers,
        include_raw_data: form.httpIncludeRawData,
      });
    }
    case "mqtt":
      return JSON.stringify({
        broker_url: form.mqttBrokerUrl.trim(),
        topic: form.mqttTopic.trim(),
        username: form.mqttUsername.trim(),
        password: form.mqttPassword.trim(),
        qos: form.mqttQos,
      });
    default:
      return "{}";
  }
}
