/**
 * Form submission logic for the action form dialog.
 */

import { useCallback } from "react";
import {
  createAction,
  updateAction,
} from "../../../api/actions";
import i18n from "../../../i18n";
import type { Action, TriggerConditions } from "../../../types";
import { useFormSubmit } from "../../../hooks/useFormSubmit";
import type { ActionFormState } from "./useActionFormDialog";
import { buildConfiguration } from "../../../domain/actions/actionConfiguration";
import { validateActionTypeFields } from "../../../domain/actions/validateActionTypeFields";

interface UseActionFormSubmitOptions {
  form: ActionFormState;
  editAction: Action | null;
  onClose: () => void;
  onSaved: () => void;
  setFieldErrors: (errors: Record<string, string>) => void;
}

export function useActionFormSubmit({
  form,
  editAction,
  onClose,
  onSaved,
  setFieldErrors,
}: UseActionFormSubmitOptions) {
  const { submitting, error, handleSubmit: submitForm, clearError } = useFormSubmit();

  const handleSubmit = useCallback(async () => {
    await submitForm(async () => {
      const name = form.name.trim();
      if (!name) {
        throw new Error(i18n.t("actions:form.errors.nameRequired"));
      }
      if (!form.actionType) {
        throw new Error(i18n.t("actions:form.errors.typeRequired"));
      }

      // ActionType-specific validation using configValidation utilities
      const validation = validateActionTypeFields(form);
      if (!validation.valid) {
        setFieldErrors(validation.errors);
        const firstError = Object.values(validation.errors)[0];
        throw new Error(firstError ?? i18n.t("actions:form.errors.validationFailed"));
      }

      const configuration = buildConfiguration(form);

      const tc: TriggerConditions = {};
      const threshold = form.scoreThreshold.trim();
      if (threshold) {
        const num = Number(threshold);
        if (Number.isNaN(num) || num < 0) {
          throw new Error(i18n.t("actions:form.errors.scoreInvalid"));
        }
        tc.score_threshold = num;
      }
      if (form.taskId) {
        tc.task_id = form.taskId;
      }
      const triggerConditions = Object.keys(tc).length > 0 ? JSON.stringify(tc) : null;

      if (editAction) {
        await updateAction(editAction.id, {
          name,
          actionType: form.actionType,
          configuration,
          triggerConditions,
        });
      } else {
        await createAction({
          name,
          actionType: form.actionType,
          configuration,
          triggerConditions,
        });
      }
      onSaved();
      onClose();
    });
  }, [form, editAction, onSaved, onClose, submitForm, setFieldErrors]);

  return {
    submitting,
    error,
    handleSubmit,
    clearError,
  };
}
