import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface OverlayPortalProps {
  children: ReactNode;
  /** Extra classes merged onto the overlay shell. */
  className?: string;
  onOverlayClick?: () => void;
  testId?: string;
  /** When true, sets document.body.style.overflow = hidden while mounted. */
  lockBodyScroll?: boolean;
  role?: string;
  "aria-modal"?: boolean | "true" | "false";
  "aria-label"?: string;
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
  role,
  "aria-modal": ariaModal,
  "aria-label": ariaLabel,
}: OverlayPortalProps) {
  useEffect(() => {
    if (!lockBodyScroll) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lockBodyScroll]);

  return createPortal(
    <div
      className={[
        "im-animate-in fixed inset-0 z-[2000] flex items-center justify-center bg-[color-mix(in_srgb,var(--surface-base)_55%,transparent)] backdrop-blur-[8px]",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid={testId}
      onClick={onOverlayClick}
      role={role}
      aria-modal={ariaModal}
      aria-label={ariaLabel}
    >
      {children}
    </div>,
    document.body,
  );
}
