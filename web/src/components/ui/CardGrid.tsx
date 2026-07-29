import type { CSSProperties, ReactNode } from "react";

interface CardGridProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  "data-allow-opacity-transition"?: boolean;
}

/**
 * Spaced tile grid — up to 4 columns on desktop (1280px window) with visible gaps.
 * Breakpoints: 1 → 2 (sm) → 3 (lg) → 4 (xl, ≥1280px viewport).
 */
export function CardGrid({
  children,
  className,
  style,
  "data-allow-opacity-transition": allowOpacityTransition,
}: CardGridProps) {
  const cls = [
    "grid grid-cols-1 gap-card-gap sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&>*]:min-w-0 [&>*]:h-full",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} style={style} data-allow-opacity-transition={allowOpacityTransition}>
      {children}
    </div>
  );
}
