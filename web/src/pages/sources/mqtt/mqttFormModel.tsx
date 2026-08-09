import { useTranslation } from "react-i18next";
import { SourceEditDialogShell } from "../board/SourceEditDialogShell";
import type { MqttBrokerInfo } from "../../../types";
import { MqttBrokerFields, type MqttBrokerFieldsValue } from "./MqttBrokerFields";

export type MqttFormFields = MqttBrokerFieldsValue;

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
      <MqttBrokerFields
        form={form}
        setForm={setForm}
        submitting={submitting}
        isEdit
        idPrefix="mqtt-edit"
      />
    </SourceEditDialogShell>
  );
}
