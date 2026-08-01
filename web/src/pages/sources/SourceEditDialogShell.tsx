import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertBanner, Button, FormActions } from "../../components/ui";
import { ModalDialog } from "../../components/ModalDialog";

interface SourceEditDialogShellProps {
  title: string;
  submitting: boolean;
  /** Rendered as an error banner below the form body; omit when the form renders its own. */
  error?: string | null;
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
  savingLabel?: string;
  children: ReactNode;
}

/** Shared modal chrome for source edit forms: header + footer actions + error banner. */
export function SourceEditDialogShell({
  title,
  submitting,
  error,
  onClose,
  onSave,
  saveLabel,
  savingLabel,
  children,
}: SourceEditDialogShellProps) {
  const { t } = useTranslation("sources");
  const resolvedSave = saveLabel ?? t("shared.saveAndReconnect");
  const resolvedSaving = savingLabel ?? t("shared.saving");

  return (
    <ModalDialog
      open
      title={title}
      onClose={onClose}
      footer={
        <FormActions inline>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t("shared.cancel")}
          </Button>
          <Button variant="primary" onClick={onSave} disabled={submitting}>
            {submitting ? resolvedSaving : resolvedSave}
          </Button>
        </FormActions>
      }
    >
      {children}
      {error ? (
        <AlertBanner
          variant="error"
          role="alert"
          className="mt-md max-h-28 overflow-y-auto break-words leading-snug"
        >
          {error}
        </AlertBanner>
      ) : null}
    </ModalDialog>
  );
}
