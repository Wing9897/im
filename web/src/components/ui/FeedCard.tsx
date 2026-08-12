import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { cardBodyClass, cardMetaClass } from "./pageTypography";

type FeedCardDensity = "compact" | "default" | "spacious";

interface FeedCardProps {
  header?: ReactNode;
  meta?: ReactNode;
  body?: ReactNode;
  footer?: ReactNode;
  /** Fully custom content, rendered after the slotted props. Use instead of (or alongside) slots. */
  children?: ReactNode;
  density?: FeedCardDensity;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  "data-testid"?: string;
  "aria-label"?: string;
}

const densityClass: Record<FeedCardDensity, string> = {
  compact: "gap-1 px-md py-sm",
  default: "gap-1.5 px-card-inner py-md",
  spacious: "gap-sm px-card-inner py-md",
};

/** Body summary — 3 lines max for consistent tile height rhythm. */
const BODY_CLAMP_CLASS = `line-clamp-3 min-w-0 flex-1 break-words ${cardBodyClass}`;

/**
 * Discrete content tile for card grids.
 * Panel material (--surface-panel + blur); no overflow-hidden (clips backdrop-filter).
 */
export function FeedCard({
  header,
  meta,
  body,
  footer,
  children,
  density = "compact",
  onClick,
  className,
  style,
  "data-testid": dataTestId,
  "aria-label": ariaLabel,
}: FeedCardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  const cls = [
    "im-feed-tile im-material-panel flex h-full min-h-[96px] min-w-0 flex-col rounded-lg transition-[border-color,background,box-shadow,transform] duration-[var(--im-duration-fast)] ease-[var(--im-easing-out)]",
    densityClass[density],
    onClick
      ? "cursor-pointer hover:border-[color-mix(in_srgb,var(--accent)_32%,var(--surface-border))] hover:bg-[color-mix(in_srgb,var(--surface-panel)_94%,var(--accent)_6%)] hover:shadow-[0_3px_12px_color-mix(in_srgb,var(--text-primary)_7%,transparent)] motion-safe:hover:-translate-y-px"
      : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cls}
      style={style}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      data-testid={dataTestId}
    >
      {header != null ? (
        <div className="flex min-h-[1.2rem] shrink-0 items-start justify-between gap-sm">
          {header}
        </div>
      ) : null}
      {meta != null ? (
        <div className={`min-h-[1rem] shrink-0 truncate leading-snug ${cardMetaClass}`}>
          {meta}
        </div>
      ) : null}
      {body != null ? <div className={BODY_CLAMP_CLASS}>{body}</div> : null}
      {footer != null ? (
        <div className={`mt-auto flex shrink-0 items-center gap-sm pt-0.5 ${cardMetaClass}`}>
          {footer}
        </div>
      ) : null}
      {children}
    </div>
  );
}
