import type { CSSProperties, ReactNode } from "react";

interface CardGridProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /**
   * `default` — up to 4 columns on desktop.
   * `compact` — max 2 columns (dialogs / nested sections).
   */
  density?: "default" | "compact";
  "data-allow-opacity-transition"?: boolean;
}

const densityClass: Record<NonNullable<CardGridProps["density"]>, string> = {
  default:
    "grid grid-cols-1 gap-card-gap sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&>*]:min-w-0 [&>*]:h-full",
  compact:
    "grid grid-cols-1 gap-card-gap sm:grid-cols-2 [&>*]:min-w-0 [&>*]:h-full",
};

/**
 * Spaced tile grid — shared by Items / workset / dashboard entity cards.
 * Default breakpoints: 1 → 2 (sm) → 3 (lg) → 4 (xl, ≥1280px viewport).
 */
export function CardGrid({
  children,
  className,
  style,
  density = "default",
  "data-allow-opacity-transition": allowOpacityTransition,
}: CardGridProps) {
  const cls = [densityClass[density], className ?? ""].filter(Boolean).join(" ");

  return (
    <div className={cls} style={style} data-allow-opacity-transition={allowOpacityTransition}>
      {children}
    </div>
  );
}
