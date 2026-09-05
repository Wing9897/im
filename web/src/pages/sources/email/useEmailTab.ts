import { useCallback, useState } from "react";
import {
  createEmailMailbox,
  deleteSource,
  listEmailMailboxes,
  updateEmailMailbox,
} from "../../../api/sources";
import i18n from "../../../i18n";
import type { EmailMailboxInfo } from "../../../types";
import { useFormSubmit } from "../../../hooks/useFormSubmit";
import { useSourceListTab } from "../board/useSourceListTab";
import { useSourceEditController } from "../board/useSourceEditController";
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

const removeEmailMailbox = (target: EmailMailboxInfo) =>
  deleteSource(target.source.id);
const formatEditError = (error: unknown) =>
  error instanceof Error
    ? error.message
    : String(i18n.t("sources:email.updateFailed"));

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
  const {
    submitting,
    error: submitError,
    errorCode: submitErrorCode,
    handleSubmit,
  } = useFormSubmit();

  const [editResetCursors, setEditResetCursors] = useState(false);

  const setPreset = useCallback((preset: EmailProviderPreset) => {
    setForm((current) => applyEmailPreset(current, preset));
  }, []);

  const validateForm = useCallback(
    (fields: EmailFormFields, isEdit: boolean) => {
      const result = validateEmailImapConfig(
        formToValidationInput(fields, isEdit),
      );
      if (!result.valid) {
        return (
          Object.values(result.errors)[0] ??
          String(i18n.t("sources:email.validationFailed"))
        );
      }
      return null;
    },
    [],
  );

  const saveEdit = useCallback(
    async (target: EmailMailboxInfo, fields: EmailFormFields) => {
      const response = await updateEmailMailbox(
        target.source.id,
        formToPatch(fields, editResetCursors),
      );
      if (response.status === "error" && response.errorMessage) {
        throw new Error(response.errorMessage);
      }
    },
    [editResetCursors],
  );

  const edit = useSourceEditController<EmailMailboxInfo, EmailFormFields>({
    toForm: mailboxToForm,
    validate: (fields) => validateForm(fields, true),
    save: saveEdit,
    refresh: fetchMailboxes,
    formatError: formatEditError,
  });

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

  const openEditDialog = useCallback(
    (mailbox: EmailMailboxInfo) => {
      setEditResetCursors(false);
      edit.openEditDialog(mailbox);
    },
    [edit],
  );

  const closeEditDialog = useCallback(() => {
    setEditResetCursors(false);
    edit.closeEditDialog();
  }, [edit]);

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
    formErrorCode: formError ? null : submitErrorCode,
    removeTarget,
    setRemoveTarget,
    removing,
    handleAddMailbox,
    handleRemoveMailbox,
    editTarget: edit.editTarget,
    editForm: edit.editForm,
    setEditForm: edit.setEditForm,
    editResetCursors,
    setEditResetCursors,
    editSubmitting: edit.editSubmitting,
    editError: edit.editError,
    openEditDialog,
    closeEditDialog,
    handleSaveEdit: edit.handleSaveEdit,
  };
}
