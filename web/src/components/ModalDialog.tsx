import { useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { OverlayPortal } from "./common/OverlayPortal";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface ModalDialogProps {
  open: boolean;
  title?: string;
  ariaLabel?: string;
  closeAriaLabel?: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  footerJustify?: "flex-start" | "flex-end" | "center" | "space-between";
  testId?: string;
  /**
   * Shell width preset.
   * - default / wide / xl: compact pickers
   * - form: wider create/edit forms (e.g. notifications)
   */
  size?: "default" | "wide" | "xl" | "form";
  /** Extra class on the scrollable body (e.g. picker flex layout). */
  bodyClassName?: string;
  /** Body padding preset. ``none`` for full-bleed filter/picker content. */
  bodyPadding?: "default" | "none";
}

const MODAL_SHELL: Record<NonNullable<ModalDialogProps["size"]>, string> = {
  default: "w-[400px] max-w-[min(92vw,400px)] max-h-[min(78vh,640px)]",
  wide: "w-[480px] max-w-[min(92vw,480px)] max-h-[min(78vh,640px)]",
  xl: "w-[560px] max-w-[min(92vw,560px)] max-h-[min(78vh,640px)]",
  form: "w-[720px] max-w-[min(94vw,720px)] max-h-[min(86vh,780px)]",
};

/** Shared accessible shell for compact filter and picker dialogs. */
export function ModalDialog({
  open,
  title,
  ariaLabel,
  closeAriaLabel,
  onClose,
  children,
  footer,
  footerJustify = "flex-end",
  testId,
  size = "default",
  bodyClassName,
  bodyPadding = "default",
}: ModalDialogProps) {
  const { t } = useTranslation("common");
  const resolvedCloseAria = closeAriaLabel ?? t("dialog.close");
  const titleId = useId();
  const focusTrapRef = useFocusTrap({ active: open, onEscape: onClose });

  if (!open) return null;

  const shellCls = [
    MODAL_SHELL[size],
    "im-dialog-shell im-material-glass im-animate-in-scale flex flex-col overflow-hidden",
  ].join(" ");

  const headerCls = [
    "flex items-center justify-between gap-sm",
    title ? "px-lg pt-lg pb-sm" : "px-lg pt-md",
  ].join(" ");

  const bodyCls = [
    "min-h-0 flex-1 overflow-auto",
    bodyPadding === "none" ? "" : "px-lg py-md",
    bodyClassName ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const footerJustifyClass: Record<NonNullable<ModalDialogProps["footerJustify"]>, string> = {
    "flex-start": "justify-start",
    "flex-end": "justify-end",
    center: "justify-center",
    "space-between": "justify-between",
  };

  return (
    <OverlayPortal testId={testId} onOverlayClick={onClose} lockBodyScroll>
      <div
        ref={focusTrapRef}
        className={shellCls}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={headerCls}>
          {title ? (
            <h2
              id={titleId}
              className="m-0 text-section-title font-semibold tracking-tight text-text-primary"
            >
              {title}
            </h2>
          ) : null}
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-none bg-transparent text-text-muted transition-colors hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)] hover:text-text-primary"
            aria-label={resolvedCloseAria}
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className={bodyCls}>{children}</div>
        <div
          className={`flex gap-sm border-t border-surface-border/80 px-lg py-md ${footerJustifyClass[footerJustify]}`}
        >
          {footer}
        </div>
      </div>
    </OverlayPortal>
  );
}
