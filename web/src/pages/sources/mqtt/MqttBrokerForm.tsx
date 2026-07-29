import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, PasswordField, SettingsRow, TextField } from "../../../components/ui";
import { SourceAddFormCard } from "../SourceAddFormCard";

const MAX_TOPICS = 20;

interface MqttTopicEditorProps {
  topics: string[];
  setTopics: (v: string[]) => void;
  submitting: boolean;
}

function MqttTopicEditor({ topics, setTopics, submitting }: MqttTopicEditorProps) {
  const { t } = useTranslation("sources");
  const handleTopicChange = (index: number, value: string) => {
    const next = [...topics];
    next[index] = value;
    setTopics(next);
  };

  const handleAddTopic = () => {
    if (topics.length < MAX_TOPICS) {
      setTopics([...topics, ""]);
    }
  };

  const handleRemoveTopic = (index: number) => {
    if (topics.length > 1) {
      const next = topics.filter((_, i) => i !== index);
      setTopics(next);
    }
  };

  return (
    <SettingsRow
      label={t("mqttFields.topics", { max: MAX_TOPICS })}
      help={t("mqttFields.topicsHelp")}
    >
      <div className="flex flex-col gap-sm">
        {topics.map((topic, index) => (
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
            {topics.length > 1 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
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
        {topics.length < MAX_TOPICS ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={handleAddTopic}
            disabled={submitting}
          >
            {t("mqttFields.addTopic")}
          </Button>
        ) : null}
      </div>
    </SettingsRow>
  );
}

interface MqttBrokerFormProps {
  brokerUrl: string;
  setBrokerUrl: (v: string) => void;
  topics: string[];
  setTopics: (v: string[]) => void;
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  clientId: string;
  setClientId: (v: string) => void;
  submitting: boolean;
  formError: string | null;
  onSubmit: () => void;
}

export function MqttBrokerForm({
  brokerUrl,
  setBrokerUrl,
  topics,
  setTopics,
  username,
  setUsername,
  password,
  setPassword,
  clientId,
  setClientId,
  submitting,
  formError,
  onSubmit,
}: MqttBrokerFormProps) {
  const { t } = useTranslation("sources");
  return (
    <SourceAddFormCard
      formError={formError}
      submitting={submitting}
      submittingLabel={t("mqttFields.adding")}
      submitLabel={t("mqttFields.addBroker")}
      submitDisabled={!brokerUrl.trim()}
      onSubmit={onSubmit}
    >
      <div className="flex flex-col gap-xl">
        <SettingsRow label={t("mqtt.brokerUrl")} htmlFor="mqtt-broker-url">
          <TextField
            id="mqtt-broker-url"
            type="text"
            placeholder="mqtt://broker.example.com:1883"
            value={brokerUrl}
            onChange={(e) => setBrokerUrl(e.target.value)}
            disabled={submitting}
          />
        </SettingsRow>

        <MqttTopicEditor topics={topics} setTopics={setTopics} submitting={submitting} />

        <SettingsRow label={t("mqttFields.username")} htmlFor="mqtt-username">
          <TextField
            id="mqtt-username"
            type="text"
            placeholder={t("mqttFields.usernamePlaceholder")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={submitting}
          />
        </SettingsRow>

        <SettingsRow label={t("mqttFields.password")} htmlFor="mqtt-password">
          <PasswordField
            id="mqtt-password"
            placeholder={t("mqttFields.passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
        </SettingsRow>

        <SettingsRow label={t("mqttFields.clientId")} htmlFor="mqtt-client-id">
          <TextField
            id="mqtt-client-id"
            type="text"
            placeholder={t("mqttFields.clientIdPlaceholder")}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={submitting}
          />
        </SettingsRow>
      </div>
    </SourceAddFormCard>
  );
}
