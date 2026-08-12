import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui";
import { sectionTitleClass } from "../ui/pageTypography";
import { OverlayPortal } from "../common/OverlayPortal";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { dialogShellClass } from "./dialogShellClasses";

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
  const titleId = useId();
  const focusTrapRef = useFocusTrap({ active: true, onEscape: onCancel });

  return (
    <OverlayPortal onOverlayClick={onCancel} lockBodyScroll>
      <div
        ref={focusTrapRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${dialogShellClass} im-animate-in-scale w-full max-w-[400px] rounded-lg p-md`}
        style={{
          border: `1px solid color-mix(in srgb, ${accentColor} 40%, transparent)`,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div id={titleId} className={`mb-sm ${sectionTitleClass}`} style={{ color: accentColor }}>
          {title}
        </div>
        <div className="mb-md text-[12px] leading-relaxed text-text-secondary">{body}</div>
        <div className="flex justify-end gap-sm">
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            {t("dialog.cancel")}
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void onConfirm()}>
            {busy ? confirmBusyLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </OverlayPortal>
  );
}
