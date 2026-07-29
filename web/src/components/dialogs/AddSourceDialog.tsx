import type React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui";
import { sectionTitleClass } from "../../components/ui/pageTypography";
import { OverlayPortal } from "../common/OverlayPortal";
import { useFocusTrap } from "../../hooks/useFocusTrap";

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
  const focusTrapRef = useFocusTrap({
    active: open,
    onEscape: onCancel,
  });

  if (!open) return null;

  const resolvedSubmit = submitLabel ?? t("ui.confirm");

  return (
    <OverlayPortal onOverlayClick={onCancel} lockBodyScroll>
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        className="im-material-glass im-animate-in-scale w-[380px] max-w-[90vw] rounded-xl border border-surface-border bg-surface-base p-lg shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`mb-md ${sectionTitleClass}`}>{title}</div>
        {error ? (
          <div className="mb-sm text-caption text-error">{error}</div>
        ) : null}
        {children}
        <div className="mt-lg flex justify-end gap-sm">
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
        </div>
      </div>
    </OverlayPortal>
  );
}
