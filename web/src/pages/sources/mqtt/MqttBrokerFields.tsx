import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, PasswordField, SettingsRow, TextField } from "../../../components/ui";

export const MQTT_MAX_TOPICS = 20;

/** Shared add/edit form shape (payload helpers live in mqttFormModel). */
export type MqttBrokerFieldsValue = {
  brokerUrl: string;
  topics: string[];
  username: string;
  password: string;
  clientId: string;
};

interface MqttBrokerFieldsProps {
  form: MqttBrokerFieldsValue;
  setForm: React.Dispatch<React.SetStateAction<MqttBrokerFieldsValue>>;
  submitting: boolean;
  isEdit?: boolean;
  /** Prefix for input ids when add + edit may mount together. */
  idPrefix?: string;
}

/** Shared broker URL / topics / credentials fields (add + edit). */
export function MqttBrokerFields({
  form,
  setForm,
  submitting,
  isEdit,
  idPrefix = "mqtt",
}: MqttBrokerFieldsProps) {
  const { t } = useTranslation("sources");
  const handleTopicChange = (index: number, value: string) => {
    setForm((current) => {
      const next = [...current.topics];
      next[index] = value;
      return { ...current, topics: next };
    });
  };

  const handleAddTopic = () => {
    if (form.topics.length < MQTT_MAX_TOPICS) {
      setForm((current) => ({ ...current, topics: [...current.topics, ""] }));
    }
  };

  const handleRemoveTopic = (index: number) => {
    if (form.topics.length <= 1) return;
    setForm((current) => ({
      ...current,
      topics: current.topics.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="flex flex-col gap-xl">
      <SettingsRow label={t("mqtt.brokerUrl")} htmlFor={`${idPrefix}-broker-url`}>
        <TextField
          id={`${idPrefix}-broker-url`}
          type="text"
          placeholder="mqtt://broker.example.com:1883"
          value={form.brokerUrl}
          onChange={(e) => setForm((s) => ({ ...s, brokerUrl: e.target.value }))}
          disabled={submitting}
        />
      </SettingsRow>

      <SettingsRow
        label={t("mqttFields.topics", { max: MQTT_MAX_TOPICS })}
        help={t("mqttFields.topicsHelp")}
      >
        <div className="flex flex-col gap-sm">
          {form.topics.map((topic, index) => (
            <div key={index} className="flex items-center gap-sm">
              <TextField
                className="min-w-0 flex-1"
                type="text"
                placeholder={t("mqttFields.topicPlaceholder")}
                value={topic}
                onChange={(e) => handleTopicChange(index, e.target.value)}
                disabled={submitting}
                aria-label={t("mqttFields.topicAria", { index: index + 1 })}
              />
              {form.topics.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="shrink-0 px-2.5"
                  onClick={() => handleRemoveTopic(index)}
                  disabled={submitting}
                  aria-label={t("mqttFields.removeTopicAria", { index: index + 1 })}
                >
                  <X size={18} strokeWidth={2} aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          ))}
          {form.topics.length < MQTT_MAX_TOPICS ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="self-start"
              onClick={handleAddTopic}
              disabled={submitting}
            >
              {t("mqttFields.addTopic")}
            </Button>
          ) : null}
        </div>
      </SettingsRow>

      <SettingsRow label={t("mqttFields.username")} htmlFor={`${idPrefix}-username`}>
        <TextField
          id={`${idPrefix}-username`}
          type="text"
          placeholder={t("mqttFields.usernamePlaceholder")}
          value={form.username}
          onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
          disabled={submitting}
        />
      </SettingsRow>

      <SettingsRow label={t("mqttFields.password")} htmlFor={`${idPrefix}-password`}>
        <PasswordField
          id={`${idPrefix}-password`}
          placeholder={
            isEdit ? t("httpFields.secretKeep") : t("mqttFields.passwordPlaceholder")
          }
          value={form.password}
          onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
          disabled={submitting}
        />
      </SettingsRow>

      <SettingsRow label={t("mqttFields.clientId")} htmlFor={`${idPrefix}-client-id`}>
        <TextField
          id={`${idPrefix}-client-id`}
          type="text"
          placeholder={t("mqttFields.clientIdPlaceholder")}
          value={form.clientId}
          onChange={(e) => setForm((s) => ({ ...s, clientId: e.target.value }))}
          disabled={submitting}
        />
      </SettingsRow>
    </div>
  );
}
