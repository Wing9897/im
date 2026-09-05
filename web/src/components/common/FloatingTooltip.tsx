import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { zIndex } from "../../styles/tokens";

type FloatingTooltipProps = {
  open: boolean;
  children: ReactNode;
  className?: string;
  placement?: "below" | "above";
  id?: string;
  role?: string;
  testId?: string;
} & (
  | { anchorRef: RefObject<HTMLElement | null>; anchorEl?: never }
  | { anchorEl: HTMLElement | null; anchorRef?: never }
);

const VIEWPORT_PAD = 8;
const GAP = 6;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Fixed-position tooltip portaled to document.body so it is not clipped by
 * overflow:hidden / scroll ancestors (gantt panels, cards, etc.).
 */
export function FloatingTooltip(props: FloatingTooltipProps) {
  const {
    open,
    children,
    className,
    placement = "below",
    id,
    role = "tooltip",
    testId = "floating-tooltip",
  } = props;
  const [style, setStyle] = useState<CSSProperties | null>(null);

  const resolveAnchor = (): HTMLElement | null => {
    if ("anchorEl" in props && props.anchorEl !== undefined) return props.anchorEl;
    if ("anchorRef" in props && props.anchorRef) return props.anchorRef.current;
    return null;
  };

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }

    const update = () => {
      const el = resolveAnchor();
      if (!el) {
        setStyle(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const tip = document.querySelector<HTMLElement>(
        `[data-testid="${testId}"]`,
      );
      const tipW = tip?.offsetWidth ?? 220;
      const tipH = tip?.offsetHeight ?? 72;

      let top =
        placement === "above" ? rect.top - tipH - GAP : rect.bottom + GAP;
      if (placement === "below" && top + tipH > vh - VIEWPORT_PAD) {
        top = rect.top - tipH - GAP;
      } else if (placement === "above" && top < VIEWPORT_PAD) {
        top = rect.bottom + GAP;
      }
      top = clamp(top, VIEWPORT_PAD, Math.max(VIEWPORT_PAD, vh - tipH - VIEWPORT_PAD));

      let left = rect.left;
      left = clamp(left, VIEWPORT_PAD, Math.max(VIEWPORT_PAD, vw - tipW - VIEWPORT_PAD));

      setStyle({
        position: "fixed",
        top,
        left,
        zIndex: zIndex.tooltip,
      });
    };

    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
    // resolveAnchor reads current props; re-run when open/placement/anchor identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- anchorEl/ref read inside update
  }, [open, placement, testId, "anchorEl" in props ? props.anchorEl : props.anchorRef, children]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      id={id}
      role={role}
      data-testid={testId}
      className={[
        "im-menu-surface pointer-events-none max-w-[320px] whitespace-pre-line rounded-lg px-md py-sm text-xs text-text-primary shadow-lg",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style ?? { position: "fixed", top: -9999, left: -9999, zIndex: zIndex.tooltip }}
    >
      {children}
    </div>,
    document.body,
  );
}
