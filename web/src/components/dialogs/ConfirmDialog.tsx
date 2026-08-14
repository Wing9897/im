import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui";
import { ModalDialog } from "../ModalDialog";

interface ConfirmDialogProps {
  title: string;
  /** Accent colour for the title and dialog border. Defaults to the error red. */
  accentColor?: string;
  body: ReactNode;
  confirmLabel: string;
  confirmBusyLabel: string;
  /** While busy, both buttons are disabled and the confirm label switches. */
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

/**
 * Single parameterized confirmation dialog for destructive / irreversible
 * actions (delete, reset, regenerate).
 */
export function ConfirmDialog({
  title,
  accentColor = "var(--error)",
  body,
  confirmLabel,
  confirmBusyLabel,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <ModalDialog
      open
      role="alertdialog"
      hideCloseButton
      title={title}
      titleStyle={{ color: accentColor }}
      shellStyle={{
        border: `1px solid color-mix(in srgb, ${accentColor} 40%, transparent)`,
      }}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            {t("dialog.cancel")}
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void onConfirm()}>
            {busy ? confirmBusyLabel : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[12px] leading-relaxed text-text-secondary">{body}</div>
    </ModalDialog>
  );
}
