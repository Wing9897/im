import { useCallback, useState } from "react";
import {
  listMqttBrokers,
  deleteSource,
  createMqttBroker,
  updateMqttBroker,
} from "../../../api/sources";
import type { MqttBrokerInfo } from "../../../types";
import { useFormSubmit } from "../../../hooks/useFormSubmit";
import { useSourceListTab } from "../useSourceListTab";
import { useSourceEditController } from "../useSourceEditController";
import { validateMqttBrokerUrl, validateMqttTopicList } from "../../../utils/configValidation";
import i18n from "../../../i18n";
import {
  brokerToForm,
  formToCreatePayload,
  formToPatch,
  type MqttFormFields,
} from "./mqttFormModel";

function validateMqttSourceForm(brokerUrl: string, topics: string[]): string | null {
  return validateMqttBrokerUrl(brokerUrl) ?? validateMqttTopicList(topics);
}

const validateMqttEditForm = (form: MqttFormFields) =>
  validateMqttSourceForm(form.brokerUrl, form.topics);
const formatEditError = (error: unknown) =>
  error instanceof Error ? error.message : String(i18n.t("sources:errors.updateFailed"));

async function saveMqttSource(target: MqttBrokerInfo, form: MqttFormFields) {
  const response = await updateMqttBroker(target.source.id, formToPatch(form));
  if (response.status === "error" && response.errorMessage) {
    throw new Error(response.errorMessage);
  }
}

const INITIAL_MQTT_FORM: MqttFormFields = {
  brokerUrl: "",
  topics: [""],
  username: "",
  password: "",
  clientId: "",
};

const removeMqttBroker = (target: MqttBrokerInfo) => deleteSource(target.source.id);

export function useMqttTab() {
  const {
    items: sources,
    initialLoading,
    isRefreshing,
    error,
    retrying,
    fetchItems: fetchMqttSources,
    handleRetry,
    removeTarget,
    setRemoveTarget,
    removing,
    confirmRemove: handleRemoveMqttSource,
  } = useSourceListTab<MqttBrokerInfo>({ listFn: listMqttBrokers, removeFn: removeMqttBroker });

  const [form, setForm] = useState<MqttFormFields>(INITIAL_MQTT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const { submitting, error: submitError, handleSubmit } = useFormSubmit();

  const edit = useSourceEditController<MqttBrokerInfo, MqttFormFields>({
    toForm: brokerToForm,
    validate: validateMqttEditForm,
    save: saveMqttSource,
    refresh: fetchMqttSources,
    formatError: formatEditError,
  });

  const handleAddMqttSource = useCallback(async () => {
    setFormError(null);

    const validationError = validateMqttSourceForm(form.brokerUrl, form.topics);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    await handleSubmit(async () => {
      const resp = await createMqttBroker(formToCreatePayload(form));
      if (resp.status === "error" && resp.errorMessage) {
        throw new Error(resp.errorMessage);
      }
      setForm(INITIAL_MQTT_FORM);
      setFormError(null);
      await fetchMqttSources();
    });
  }, [form, fetchMqttSources, handleSubmit]);

  const displayFormError = formError || submitError;

  return {
    sources,
    initialLoading,
    isRefreshing,
    error,
    form,
    setForm,
    submitting,
    formError: displayFormError,
    removeTarget,
    setRemoveTarget,
    removing,
    retrying,
    fetchMqttSources,
    handleRetry,
    handleAddMqttSource,
    handleRemoveMqttSource,
    ...edit,
  };
}
