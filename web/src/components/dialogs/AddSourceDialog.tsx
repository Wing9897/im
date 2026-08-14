import type React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui";
import { ModalDialog } from "../ModalDialog";

interface AddSourceDialogProps {
  open: boolean;
  title: string;
  onSubmit: () => void;
  onCancel: () => void;
  error?: string | null;
  submitLabel?: string;
  submittingLabel?: string;
  submitting?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}

/** Shared dialog for add-source and remove-confirmation flows in source tabs. */
export function AddSourceDialog({
  open,
  title,
  onSubmit,
  onCancel,
  error,
  submitLabel,
  submittingLabel,
  submitting = false,
  danger = false,
  children,
}: AddSourceDialogProps) {
  const { t } = useTranslation("common");
  const resolvedSubmit = submitLabel ?? t("ui.confirm");

  return (
    <ModalDialog
      open={open}
      title={title}
      onClose={onCancel}
      size="compact"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            {t("dialog.cancel")}
          </Button>
          <Button
            variant={danger ? "danger" : "secondary"}
            disabled={submitting}
            onClick={onSubmit}
          >
            {submitting && submittingLabel ? submittingLabel : resolvedSubmit}
          </Button>
        </>
      }
    >
      {error ? <div className="mb-sm text-caption text-error">{error}</div> : null}
      {children}
    </ModalDialog>
  );
}
