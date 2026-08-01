import { useCallback, useState } from "react";
import {
  listMqttBrokers,
  deleteAccount,
  createMqttBroker,
  updateMqttBroker,
} from "../../../api/accounts";
import type { MqttBrokerInfo } from "../../../types";
import { useFormSubmit } from "../../../hooks/useFormSubmit";
import { useSourceListTab } from "../useSourceListTab";
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

const INITIAL_MQTT_FORM: MqttFormFields = {
  brokerUrl: "",
  topics: [""],
  username: "",
  password: "",
  clientId: "",
};

const removeMqttBroker = (target: MqttBrokerInfo) => deleteAccount(target.account.id);

export function useMqttTab() {
  const {
    items: accounts,
    initialLoading,
    isRefreshing,
    error,
    retrying,
    fetchItems: fetchMqttAccounts,
    handleRetry,
    removeTarget,
    setRemoveTarget,
    removing,
    confirmRemove: handleRemoveMqttAccount,
  } = useSourceListTab<MqttBrokerInfo>({ listFn: listMqttBrokers, removeFn: removeMqttBroker });

  const [form, setForm] = useState<MqttFormFields>(INITIAL_MQTT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const { submitting, error: submitError, handleSubmit } = useFormSubmit();

  const [editTarget, setEditTarget] = useState<MqttBrokerInfo | null>(null);
  const [editForm, setEditForm] = useState<MqttFormFields | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleAddMqttAccount = useCallback(async () => {
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
      await fetchMqttAccounts();
    });
  }, [form, fetchMqttAccounts, handleSubmit]);

  const openEditDialog = useCallback((broker: MqttBrokerInfo) => {
    setEditTarget(broker);
    setEditForm(brokerToForm(broker));
    setEditError(null);
  }, []);

  const closeEditDialog = useCallback(() => {
    setEditTarget(null);
    setEditForm(null);
    setEditError(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editTarget || !editForm) return;
    setEditError(null);
    const validationError = validateMqttSourceForm(editForm.brokerUrl, editForm.topics);
    if (validationError) {
      setEditError(validationError);
      return;
    }

    setEditSubmitting(true);
    try {
      const resp = await updateMqttBroker(editTarget.account.id, formToPatch(editForm));
      if (resp.status === "error" && resp.errorMessage) {
        throw new Error(resp.errorMessage);
      }
      closeEditDialog();
      await fetchMqttAccounts();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(i18n.t("sources:errors.updateFailed")));
    } finally {
      setEditSubmitting(false);
    }
  }, [closeEditDialog, editForm, editTarget, fetchMqttAccounts]);

  const displayFormError = formError || submitError;

  return {
    accounts,
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
    fetchMqttAccounts,
    handleRetry,
    handleAddMqttAccount,
    handleRemoveMqttAccount,
    editTarget,
    editForm,
    setEditForm,
    editSubmitting,
    editError,
    openEditDialog,
    closeEditDialog,
    handleSaveEdit,
  };
}
