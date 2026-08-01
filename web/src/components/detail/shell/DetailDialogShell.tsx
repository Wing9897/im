import type React from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OverlayPortal } from "../../common/OverlayPortal";
import { useFocusTrap } from "../../../hooks/useFocusTrap";
import {
  detailDialogCloseClass,
  detailDialogDrawerOverlayClass,
  detailDialogDrawerShellClass,
  detailDialogModalShellClass,
} from "../classes";

export type DetailDialogVariant = "modal" | "drawer";

export interface DetailDialogShellProps {
  width?: string;
  className?: string;
  children: React.ReactNode;
  onClose: () => void;
  showCloseButton?: boolean;
  variant?: DetailDialogVariant;
  "aria-label"?: string;
}

export function DetailDialogShell({
  width = "min(460px, calc(100vw - 32px))",
  className,
  children,
  onClose,
  showCloseButton = true,
  variant = "modal",
  "aria-label": ariaLabel,
}: DetailDialogShellProps) {
  const { t } = useTranslation("common");
  const focusTrapRef = useFocusTrap({ active: true, onEscape: onClose });

  const shellClassName = [
    variant === "drawer" ? detailDialogDrawerShellClass : detailDialogModalShellClass,
    "im-animate-in-scale",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const overlayClass =
    variant === "drawer" ? detailDialogDrawerOverlayClass : undefined;

  return (
    <OverlayPortal
      onOverlayClick={onClose}
      lockBodyScroll
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className={overlayClass}
    >
      <div
        ref={focusTrapRef}
        className={shellClassName}
        style={variant === "modal" ? { width } : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        {showCloseButton ? (
          <button
            type="button"
            className={detailDialogCloseClass}
            aria-label={t("dialog.close")}
            onClick={onClose}
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : null}
        {children}
      </div>
    </OverlayPortal>
  );
}
