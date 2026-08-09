import {
  useEffect,
  useRef,
  type AnimationEventHandler,
  type CSSProperties,
  type ReactNode,
} from "react";
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
   * Park the portal in the DOM without painting.
   * Used with ModalDialog `keepMounted` so expensive children stay warm.
   * Must force `display:none` — Tailwind `flex` otherwise overrides UA `[hidden]`.
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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lockBodyScroll || hidden) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lockBodyScroll, hidden]);

  // `inert` is not in React 18's DOM typings; set via DOM for parked layers.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (hidden) {
      el.setAttribute("inert", "");
    } else {
      el.removeAttribute("inert");
    }
  }, [hidden]);

  // Parked: no enter/exit animation (switching exiting→false used to re-apply
  // im-animate-in and visually "reopen" keepMounted dialogs).
  // Exiting: keep pointer-events so fade-out cannot click-through to triggers.
  const motionClass = hidden ? "" : exiting ? "im-animate-out" : "im-animate-in";
  const parkedStyle: CSSProperties | undefined = hidden
    ? { display: "none", pointerEvents: "none" }
    : exiting
      ? { pointerEvents: "auto" }
      : undefined;

  return createPortal(
    <div
      ref={rootRef}
      className={[
        motionClass,
        "fixed inset-0 z-[2000] flex items-center justify-center bg-[color-mix(in_srgb,var(--surface-base)_55%,transparent)] backdrop-blur-[8px]",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={parkedStyle}
      data-testid={testId}
      data-overlay-parked={hidden || undefined}
      hidden={hidden || undefined}
      aria-hidden={hidden || undefined}
      onClick={hidden || exiting ? undefined : onOverlayClick}
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
