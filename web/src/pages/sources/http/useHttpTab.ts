import { useCallback, useState } from "react";
import {
  listHttpSources,
  deleteAccount,
  createHttpSource,
  updateHttpSource,
} from "../../../api/accounts";
import type { HttpSourceInfo } from "../../../types";
import { useFormSubmit } from "../../../hooks/useFormSubmit";
import { useSourceListTab } from "../useSourceListTab";
import { INITIAL_HTTP_FORM, type HttpFormFields } from "./httpFormTypes";
import i18n from "../../../i18n";
import {
  formToCreatePayload,
  formToPatch,
  sourceToForm,
  validateHttpSourceForm,
} from "./httpFormConvert";

const removeHttpSource = (target: HttpSourceInfo) => deleteAccount(target.account.id);

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

  const [editTarget, setEditTarget] = useState<HttpSourceInfo | null>(null);
  const [editForm, setEditForm] = useState<HttpFormFields | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  const openEditDialog = useCallback((source: HttpSourceInfo) => {
    setEditTarget(source);
    setEditForm(sourceToForm(source));
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
    const validationError = validateHttpSourceForm(editForm);
    if (validationError) {
      setEditError(validationError);
      return;
    }

    setEditSubmitting(true);
    try {
      const resp = await updateHttpSource(editTarget.account.id, formToPatch(editForm));
      if (resp.status === "error" && resp.errorMessage) {
        throw new Error(resp.errorMessage);
      }
      closeEditDialog();
      await fetchHttpSources();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(i18n.t("sources:errors.updateFailed")));
    } finally {
      setEditSubmitting(false);
    }
  }, [closeEditDialog, editForm, editTarget, fetchHttpSources]);

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
