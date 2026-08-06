import { useEffect, type AnimationEventHandler, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface OverlayPortalProps {
  children: ReactNode;
  /** Extra classes merged onto the overlay shell. */
  className?: string;
  onOverlayClick?: () => void;
  testId?: string;
  /** When true, sets document.body.style.overflow = hidden while mounted. */
  lockBodyScroll?: boolean;
  /**
   * Park the portal in the DOM without painting (HTML `hidden`).
   * Used with ModalDialog `keepMounted` so expensive children stay warm.
   */
  hidden?: boolean;
  role?: string;
  "aria-modal"?: boolean | "true" | "false";
  "aria-label"?: string;
  /** Fade/scale exit instead of enter (caller owns unmount timing). */
  exiting?: boolean;
  onAnimationEnd?: AnimationEventHandler<HTMLDivElement>;
}

/**
 * Renders a full-screen overlay into document.body so dialogs escape
 * sticky/backdrop-filter ancestors that break position: fixed.
 */
export function OverlayPortal({
  children,
  className,
  onOverlayClick,
  testId,
  lockBodyScroll = false,
  hidden = false,
  role,
  "aria-modal": ariaModal,
  "aria-label": ariaLabel,
  exiting = false,
  onAnimationEnd,
}: OverlayPortalProps) {
  useEffect(() => {
    if (!lockBodyScroll || hidden) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lockBodyScroll, hidden]);

  return createPortal(
    <div
      className={[
        exiting ? "im-animate-out" : "im-animate-in",
        "fixed inset-0 z-[2000] flex items-center justify-center bg-[color-mix(in_srgb,var(--surface-base)_55%,transparent)] backdrop-blur-[8px]",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid={testId}
      hidden={hidden || undefined}
      aria-hidden={hidden || undefined}
      onClick={hidden ? undefined : onOverlayClick}
      onAnimationEnd={hidden ? undefined : onAnimationEnd}
      role={hidden ? undefined : role}
      aria-modal={hidden ? undefined : ariaModal}
      aria-label={hidden ? undefined : ariaLabel}
    >
      {children}
    </div>,
    document.body,
  );
}
