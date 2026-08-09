import { useTranslation } from "react-i18next";
import { SourceAddFormCard } from "../board/SourceAddFormCard";
import { MqttBrokerFields } from "./MqttBrokerFields";
import type { MqttFormFields } from "./mqttFormModel";

interface MqttBrokerFormProps {
  form: MqttFormFields;
  setForm: React.Dispatch<React.SetStateAction<MqttFormFields>>;
  submitting: boolean;
  formError: string | null;
  onSubmit: () => void;
}

export function MqttBrokerForm({
  form,
  setForm,
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
      submitDisabled={!form.brokerUrl.trim()}
      onSubmit={onSubmit}
    >
      <MqttBrokerFields form={form} setForm={setForm} submitting={submitting} idPrefix="mqtt" />
    </SourceAddFormCard>
  );
}
