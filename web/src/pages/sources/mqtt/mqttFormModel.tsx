import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, PasswordField, SettingsRow, TextField } from "../../../components/ui";
import { SourceEditDialogShell } from "../SourceEditDialogShell";
import type { MqttBrokerInfo } from "../../../types";

const MAX_TOPICS = 20;

export interface MqttFormFields {
  brokerUrl: string;
  topics: string[];
  username: string;
  password: string;
  clientId: string;
}

export function brokerToForm(broker: MqttBrokerInfo): MqttFormFields {
  return {
    brokerUrl: broker.brokerUrl,
    topics: broker.topics.length > 0 ? [...broker.topics] : [""],
    username: "",
    password: "********",
    clientId: broker.clientId || "",
  };
}

export function formToCreatePayload(form: MqttFormFields) {
  const validTopics = form.topics.map((t) => t.trim()).filter(Boolean);
  return {
    brokerUrl: form.brokerUrl.trim(),
    topics: validTopics,
    username: form.username.trim() || null,
    password: form.password || null,
    clientId: form.clientId.trim() || null,
  };
}

export function formToPatch(form: MqttFormFields) {
  return formToCreatePayload(form);
}

interface MqttBrokerFieldsProps {
  form: MqttFormFields;
  setForm: React.Dispatch<React.SetStateAction<MqttFormFields>>;
  submitting: boolean;
  isEdit?: boolean;
}

function MqttBrokerFields({ form, setForm, submitting, isEdit }: MqttBrokerFieldsProps) {
  const { t } = useTranslation("sources");
  const handleTopicChange = (index: number, value: string) => {
    setForm((current) => {
      const next = [...current.topics];
      next[index] = value;
      return { ...current, topics: next };
    });
  };

  const handleAddTopic = () => {
    if (form.topics.length < MAX_TOPICS) {
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
      <SettingsRow label={t("mqtt.brokerUrl")} htmlFor="mqtt-broker-url">
        <TextField
          id="mqtt-broker-url"
          type="text"
          placeholder="mqtt://broker.example.com:1883"
          value={form.brokerUrl}
          onChange={(e) => setForm((s) => ({ ...s, brokerUrl: e.target.value }))}
          disabled={submitting}
        />
      </SettingsRow>

      <SettingsRow label={t("mqttFields.topics", { max: MAX_TOPICS })}>
        {form.topics.map((topic, index) => (
          <div key={index} className="mb-sm flex items-center gap-sm">
            <TextField
              className="flex-1"
              type="text"
              placeholder={t("mqttFields.topicPlaceholder")}
              value={topic}
              onChange={(e) => handleTopicChange(index, e.target.value)}
              disabled={submitting}
              aria-label={t("mqttFields.topicAria", { index: index + 1 })}
            />
            {form.topics.length > 1 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleRemoveTopic(index)}
                disabled={submitting}
                aria-label={t("mqttFields.removeTopicAria", { index: index + 1 })}
              >
                <X size={18} strokeWidth={2} aria-hidden="true" />
              </Button>
            )}
          </div>
        ))}
        {form.topics.length < MAX_TOPICS && (
          <Button size="sm" variant="secondary" onClick={handleAddTopic} disabled={submitting}>
            {t("mqttFields.addTopic")}
          </Button>
        )}
      </SettingsRow>

      <SettingsRow label={t("mqttFields.username")} htmlFor="mqtt-username">
        <TextField
          id="mqtt-username"
          type="text"
          placeholder={t("mqttFields.usernamePlaceholder")}
          value={form.username}
          onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
          disabled={submitting}
        />
      </SettingsRow>

      <SettingsRow label={t("mqttFields.password")} htmlFor="mqtt-password">
        <PasswordField
          id="mqtt-password"
          placeholder={
            isEdit ? t("httpFields.secretKeep") : t("mqttFields.passwordPlaceholder")
          }
          value={form.password}
          onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
          disabled={submitting}
        />
      </SettingsRow>

      <SettingsRow label={t("mqttFields.clientId")} htmlFor="mqtt-client-id">
        <TextField
          id="mqtt-client-id"
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

interface MqttEditDialogProps {
  broker: MqttBrokerInfo;
  form: MqttFormFields;
  setForm: React.Dispatch<React.SetStateAction<MqttFormFields>>;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
}

export function MqttEditDialog({
  broker,
  form,
  setForm,
  submitting,
  error,
  onClose,
  onSave,
}: MqttEditDialogProps) {
  const { t } = useTranslation("sources");
  return (
    <SourceEditDialogShell
      title={t("mqtt.editTitle", { url: broker.brokerUrl })}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSave={onSave}
    >
      <MqttBrokerFields form={form} setForm={setForm} submitting={submitting} isEdit />
    </SourceEditDialogShell>
  );
}
