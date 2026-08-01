import { useCallback, useState } from "react";
import {
  createEmailMailbox,
  deleteAccount,
  listEmailMailboxes,
  updateEmailMailbox,
} from "../../../api/accounts";
import i18n from "../../../i18n";
import type { EmailMailboxInfo } from "../../../types";
import { useFormSubmit } from "../../../hooks/useFormSubmit";
import { useSourceListTab } from "../useSourceListTab";
import { validateEmailImapConfig } from "../../../utils/configValidation";
import {
  applyEmailPreset,
  formToCreatePayload,
  formToPatch,
  formToValidationInput,
  INITIAL_EMAIL_FORM,
  mailboxToForm,
  type EmailFormFields,
  type EmailProviderPreset,
} from "./emailFormModel";

const removeEmailMailbox = (target: EmailMailboxInfo) => deleteAccount(target.account.id);

export function useEmailTab() {
  const {
    items: mailboxes,
    initialLoading,
    isRefreshing,
    error,
    retrying,
    fetchItems: fetchMailboxes,
    handleRetry,
    removeTarget,
    setRemoveTarget,
    removing,
    confirmRemove: handleRemoveMailbox,
  } = useSourceListTab<EmailMailboxInfo>({
    listFn: listEmailMailboxes,
    removeFn: removeEmailMailbox,
  });

  const [form, setForm] = useState<EmailFormFields>(INITIAL_EMAIL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const { submitting, error: submitError, handleSubmit } = useFormSubmit();

  const [editTarget, setEditTarget] = useState<EmailMailboxInfo | null>(null);
  const [editForm, setEditForm] = useState<EmailFormFields | null>(null);
  const [editResetCursors, setEditResetCursors] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const setPreset = useCallback((preset: EmailProviderPreset) => {
    setForm((current) => applyEmailPreset(current, preset));
  }, []);

  const validateForm = useCallback((fields: EmailFormFields, isEdit: boolean) => {
    const result = validateEmailImapConfig(formToValidationInput(fields, isEdit));
    if (!result.valid) {
      return Object.values(result.errors)[0] ?? String(i18n.t("sources:email.validationFailed"));
    }
    return null;
  }, []);

  const handleAddMailbox = useCallback(async () => {
    setFormError(null);
    const validationError = validateForm(form, false);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    await handleSubmit(async () => {
      const payload = formToCreatePayload(form);
      const resp = await createEmailMailbox(payload);
      if (resp.status === "error" && resp.errorMessage) {
        throw new Error(resp.errorMessage);
      }
      setForm(INITIAL_EMAIL_FORM);
      setFormError(null);
      await fetchMailboxes();
    });
  }, [form, fetchMailboxes, handleSubmit, validateForm]);

  const openEditDialog = useCallback((mailbox: EmailMailboxInfo) => {
    setEditTarget(mailbox);
    setEditForm(mailboxToForm(mailbox));
    setEditResetCursors(false);
    setEditError(null);
  }, []);

  const closeEditDialog = useCallback(() => {
    setEditTarget(null);
    setEditForm(null);
    setEditResetCursors(false);
    setEditError(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editTarget || !editForm) return;
    setEditError(null);
    const validationError = validateForm(editForm, true);
    if (validationError) {
      setEditError(validationError);
      return;
    }

    setEditSubmitting(true);
    try {
      const resp = await updateEmailMailbox(
        editTarget.account.id,
        formToPatch(editForm, editResetCursors),
      );
      if (resp.status === "error" && resp.errorMessage) {
        throw new Error(resp.errorMessage);
      }
      closeEditDialog();
      await fetchMailboxes();
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : String(i18n.t("sources:email.updateFailed")),
      );
    } finally {
      setEditSubmitting(false);
    }
  }, [closeEditDialog, editForm, editResetCursors, editTarget, fetchMailboxes, validateForm]);

  return {
    mailboxes,
    initialLoading,
    isRefreshing,
    error,
    retrying,
    fetchMailboxes,
    handleRetry,
    form,
    setForm,
    setPreset,
    submitting,
    formError: formError || submitError,
    removeTarget,
    setRemoveTarget,
    removing,
    handleAddMailbox,
    handleRemoveMailbox,
    editTarget,
    editForm,
    setEditForm,
    editResetCursors,
    setEditResetCursors,
    editSubmitting,
    editError,
    openEditDialog,
    closeEditDialog,
    handleSaveEdit,
  };
}
