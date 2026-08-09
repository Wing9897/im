import { useCallback, useState } from "react";
import {
  listHttpSources,
  deleteSource,
  createHttpSource,
  updateHttpSource,
} from "../../../api/sources";
import type { HttpSourceInfo } from "../../../types";
import { useFormSubmit } from "../../../hooks/useFormSubmit";
import { useSourceListTab } from "../board/useSourceListTab";
import { useSourceEditController } from "../board/useSourceEditController";
import { INITIAL_HTTP_FORM, type HttpFormFields } from "./httpFormTypes";
import i18n from "../../../i18n";
import {
  formToCreatePayload,
  formToPatch,
  sourceToForm,
  validateHttpSourceForm,
} from "./httpFormConvert";

const removeHttpSource = (target: HttpSourceInfo) => deleteSource(target.source.id);
const formatEditError = (error: unknown) =>
  error instanceof Error ? error.message : String(i18n.t("sources:errors.updateFailed"));

async function saveHttpSource(target: HttpSourceInfo, form: HttpFormFields) {
  const response = await updateHttpSource(target.source.id, formToPatch(form));
  if (response.status === "error" && response.errorMessage) {
    throw new Error(response.errorMessage);
  }
}

export function useHttpTab() {
  const {
    items: sources,
    initialLoading,
    isRefreshing,
    error,
    retrying,
    fetchItems: fetchHttpSources,
    handleRetry,
    removeTarget,
    setRemoveTarget,
    removing,
    confirmRemove: handleRemoveHttpSource,
  } = useSourceListTab<HttpSourceInfo>({ listFn: listHttpSources, removeFn: removeHttpSource });

  const [form, setForm] = useState<HttpFormFields>(INITIAL_HTTP_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const { submitting, error: submitError, handleSubmit } = useFormSubmit();

  const edit = useSourceEditController<HttpSourceInfo, HttpFormFields>({
    toForm: sourceToForm,
    validate: validateHttpSourceForm,
    save: saveHttpSource,
    refresh: fetchHttpSources,
    formatError: formatEditError,
  });

  const handleAddHttpSource = useCallback(async () => {
    setFormError(null);
    const validationError = validateHttpSourceForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    await handleSubmit(async () => {
      const resp = await createHttpSource(formToCreatePayload(form));
      if (resp.status === "error" && resp.errorMessage) {
        throw new Error(resp.errorMessage);
      }
      setForm(INITIAL_HTTP_FORM);
      setFormError(null);
      await fetchHttpSources();
    });
  }, [form, fetchHttpSources, handleSubmit]);

  return {
    sources,
    initialLoading,
    isRefreshing,
    error,
    form,
    setForm,
    submitting,
    formError: formError || submitError,
    removeTarget,
    setRemoveTarget,
    removing,
    retrying,
    fetchHttpSources,
    handleRetry,
    handleAddHttpSource,
    handleRemoveHttpSource,
    ...edit,
  };
}
