import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "../../../components/ModalDialog";
import {
  AlertBanner,
  Button,
  FormActions,
  FormField,
  FormStack,
  SettingsRow,
  TextField,
} from "../../../components/ui";
import type { Action, AnalysisTask } from "../../../types";
import { useActionFormDialog } from "./useActionFormDialog";
import { ActionFormSection } from "./ActionFormSection";
import { ActionTypeSelector } from "../ActionTypeSelector";
import { ActionTypeFields } from "../ActionTypeFields";
import { ActionTriggerSection } from "./ActionTriggerSection";

export function ActionFormDialog({
  open,
  editAction,
  tasks,
  onClose,
  onSaved,
}: {
  open: boolean;
  editAction: Action | null;
  tasks: AnalysisTask[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("actions");
  const {
    form,
    fieldErrors,
    submitting,
    error,
    handleChange,
    handleChannelChange,
    handleSubmit,
  } = useActionFormDialog({ open, editAction, onClose, onSaved });

  let channelFields: ReactNode = null;
  if (form.actionType) {
    channelFields = (
      <div className="rounded-lg border border-dashed border-surface-border/70 bg-[color-mix(in_srgb,var(--surface-raised)_55%,transparent)] p-md">
        <ActionTypeFields
          form={form}
          fieldErrors={fieldErrors}
          submitting={submitting}
          onChange={handleChange}
        />
      </div>
    );
  }

  return (
    <ModalDialog
      open={open}
      size="form"
      title={editAction ? t("form.editTitle") : t("form.createTitle")}
      onClose={onClose}
      bodyClassName="flex flex-col gap-lg"
      footer={
        <FormActions inline>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t("form.cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={submitting}
            onClick={() => void handleSubmit().catch(() => {})}
          >
            {submitting ? t("form.saving") : editAction ? t("form.update") : t("form.create")}
          </Button>
        </FormActions>
      }
    >
      <FormStack gap="lg">
        <ActionFormSection step={1} title={t("form.basicInfoSection")}>
          <SettingsRow label={t("form.nameLabel")} htmlFor="action-name">
            <FormField error={fieldErrors.name}>
              <TextField
                id="action-name"
                type="text"
                placeholder={t("form.namePlaceholder")}
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                disabled={submitting}
              />
            </FormField>
          </SettingsRow>
        </ActionFormSection>

        <ActionFormSection step={2} title={t("form.channelSection")}>
          <ActionTypeSelector
            value={form.actionType}
            onChange={handleChannelChange}
            disabled={submitting}
          />
          {channelFields}
        </ActionFormSection>

        <ActionFormSection
          step={3}
          title={t("form.triggerSection")}
          note={t("form.triggerSectionNote")}
        >
          <ActionTriggerSection
            form={form}
            tasks={tasks}
            submitting={submitting}
            onChange={handleChange}
          />
        </ActionFormSection>

        {error ? (
          <AlertBanner
            variant="error"
            role="alert"
            className="max-h-28 overflow-y-auto break-words leading-snug"
          >
            {error}
          </AlertBanner>
        ) : null}
      </FormStack>
    </ModalDialog>
  );
}
