import {
  useEffect,
  useId,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { OverlayPortal } from "./common/OverlayPortal";
import { dialogShellClass } from "./dialogs/dialogShellClasses";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface ModalDialogProps {
  open: boolean;
  title?: string;
  ariaLabel?: string;
  closeAriaLabel?: string;
  /** Inner shell role. Confirm / destructive prompts use ``alertdialog``. */
  role?: "dialog" | "alertdialog";
  /** Hide the header X when the footer already has an explicit dismiss action. */
  hideCloseButton?: boolean;
  titleStyle?: CSSProperties;
  shellStyle?: CSSProperties;
  onClose: () => void;
  /**
   * Fires after the exit animation finishes (or immediately when reduced-motion /
   * keepMounted park completes). Use to commit work only once the shell is gone.
   */
  onExited?: () => void;
  children: ReactNode;
  footer: ReactNode;
  footerJustify?: "flex-start" | "flex-end" | "center" | "space-between";
  testId?: string;
  /**
   * Shell width preset.
   * - default / wide / xl: compact pickers
   * - form: wider create/edit forms (e.g. notifications)
   */
  size?: "default" | "wide" | "xl" | "form" | "compact";
  /** Replaces the size preset shell width/height classes when set. */
  shellClassName?: string;
  /** Extra class on the scrollable body (e.g. picker flex layout). */
  bodyClassName?: string;
  /** Body padding preset. ``none`` for full-bleed filter/picker content. */
  bodyPadding?: "default" | "none";
  /**
   * After the first open, keep the React tree mounted while closed (parked).
   * Use for expensive children (emoji keyboard) so reopen skips remount cost.
   * Focus trap and body scroll lock stay inactive while parked.
   */
  keepMounted?: boolean;
}

const MODAL_SHELL: Record<NonNullable<ModalDialogProps["size"]>, string> = {
  default: "box-border w-[400px] max-w-[min(92vw,400px)] max-h-[min(78vh,640px)]",
  compact: "box-border w-[380px] max-w-[min(90vw,380px)] max-h-[min(78vh,640px)]",
  wide: "box-border w-[480px] max-w-[min(92vw,480px)] max-h-[min(78vh,640px)]",
  xl: "box-border w-[560px] max-w-[min(92vw,560px)] max-h-[min(78vh,640px)]",
  form: "box-border w-[720px] max-w-[min(94vw,720px)] h-[min(86vh,780px)]",
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Shared accessible shell for compact filter and picker dialogs. */
export function ModalDialog({
  open,
  title,
  ariaLabel,
  closeAriaLabel,
  role = "dialog",
  hideCloseButton = false,
  titleStyle,
  shellStyle,
  onClose,
  onExited,
  children,
  footer,
  footerJustify = "flex-end",
  testId,
  size = "default",
  shellClassName,
  bodyClassName,
  bodyPadding = "default",
  keepMounted = false,
}: ModalDialogProps) {
  const { t } = useTranslation("common");
  const resolvedCloseAria = closeAriaLabel ?? t("dialog.close");
  const titleId = useId();
  const [present, setPresent] = useState(open);
  const [exiting, setExiting] = useState(false);
  const [parked, setParked] = useState(false);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;
  /** Ensures onExited fires once per close (animationend + timeout race). */
  const exitedNotifiedRef = useRef(false);
  const focusTrapRef = useFocusTrap({
    active: present && !exiting && !parked,
    onEscape: onClose,
  });

  const parkOrUnmount = () => {
    // jsdom teardown can drop `window` while the close fallback timeout is pending.
    if (typeof window === "undefined") return;
    setExiting(false);
    if (keepMounted) {
      setParked(true);
    } else {
      setPresent(false);
      setParked(false);
    }
    if (!exitedNotifiedRef.current) {
      exitedNotifiedRef.current = true;
      onExitedRef.current?.();
    }
  };

  useEffect(() => {
    if (open) {
      exitedNotifiedRef.current = false;
      setPresent(true);
      setExiting(false);
      setParked(false);
      return;
    }
    if (!present || parked) return;
    if (prefersReducedMotion()) {
      parkOrUnmount();
      return;
    }
    setExiting(true);
    // Fallback when animationend is skipped (e.g. CSS reduced-motion overrides).
    const timeoutId = window.setTimeout(() => {
      parkOrUnmount();
    }, 220);
    return () => window.clearTimeout(timeoutId);
    // parkOrUnmount closes over keepMounted; listed deps cover state transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional narrow deps
  }, [open, present, parked, keepMounted]);

  const handleOverlayAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (!exiting) return;
    if (event.target !== event.currentTarget) return;
    if (!event.animationName.includes("im-fade-out")) return;
    parkOrUnmount();
  };

  if (!present) return null;

  const shellCls = [
    shellClassName ?? `${MODAL_SHELL[size]} ${dialogShellClass} flex flex-col`,
    parked ? "" : exiting ? "im-animate-out-scale" : "im-animate-in-scale",
  ]
    .filter(Boolean)
    .join(" ");

  const headerCls = [
    "flex items-center justify-between gap-sm",
    title ? "px-lg pt-lg pb-sm" : "px-lg pt-md",
  ].join(" ");

  const bodyHasOverflow = Boolean(
    bodyClassName?.split(/\s+/).some((token) => token.startsWith("overflow-")),
  );
  const bodyCls = [
    "im-dialog-body box-border min-h-[7.5rem] flex-1",
    bodyHasOverflow ? "" : "overflow-auto",
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
    <OverlayPortal
      testId={testId}
      onOverlayClick={exiting || parked ? undefined : onClose}
      lockBodyScroll={!parked}
      hidden={parked}
      exiting={exiting}
      onAnimationEnd={handleOverlayAnimationEnd}
    >
      <div
        ref={focusTrapRef}
        className={shellCls}
        style={shellStyle}
        role={role}
        aria-modal={parked ? undefined : "true"}
        aria-labelledby={title && !parked ? titleId : undefined}
        aria-label={title || parked ? undefined : ariaLabel}
        onClick={(event) => event.stopPropagation()}
      >
        {title || !hideCloseButton ? (
          <div className={headerCls}>
            {title ? (
              <h2
                id={titleId}
                className="m-0 text-section-title font-semibold tracking-tight text-text-primary"
                style={titleStyle}
              >
                {title}
              </h2>
            ) : null}
            {hideCloseButton ? null : (
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-none bg-transparent text-text-muted transition-colors hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)] hover:text-text-primary"
                aria-label={resolvedCloseAria}
                disabled={exiting || parked}
                onClick={onClose}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        ) : null}
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
