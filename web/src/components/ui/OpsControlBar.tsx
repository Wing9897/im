import type { ReactNode } from "react";

interface OpsControlBarProps {
  children: ReactNode;
  ariaLabel: string;
  /** Stick under the app chrome while the page scrolls. */
  sticky?: boolean;
  className?: string;
  "data-testid"?: string;
}

/**
 * Single-row ops chrome shared by Intelligence / Timeline / Monitor / Logs / etc.
 * Callers own layout children; pass className for page-specific extras
 * (toolbar id class, mb-lg, flex-wrap, flex-col secondary row).
 */
export function OpsControlBar({
  children,
  ariaLabel,
  sticky = false,
  className,
  "data-testid": dataTestId,
}: OpsControlBarProps) {
  const rootClass = [
    "im-control-bar mb-md flex min-h-8 min-w-0 shrink-0 flex-nowrap items-center gap-1.5 px-sm py-1.5",
    sticky ? "sticky top-0 z-[100]" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rootClass}
      role="toolbar"
      aria-label={ariaLabel}
      data-testid={dataTestId}
    >
      {children}
    </div>
  );
}
