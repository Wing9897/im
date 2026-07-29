import React from "react";
import { useTranslation } from "react-i18next";

interface SkeletonScreenProps {
  /** Layout variant matching the page's content structure */
  variant: "card-grid" | "table-rows" | "list-rows";
  /** Number of placeholder items to render (default 6 for card-grid, 5 for rows) */
  count?: number;
  /** Grid columns for card-grid variant (default 4) */
  columns?: number;
}

const variantHeightClass: Record<SkeletonScreenProps["variant"], string> = {
  "card-grid": "h-[120px] rounded-lg",
  "table-rows": "h-12 rounded-md",
  "list-rows": "h-12 rounded-md",
};

/**
 * A configurable skeleton loading placeholder that displays shimmer animation
 * while content is loading. Respects prefers-reduced-motion for accessibility.
 */
export const SkeletonScreen = React.memo(function SkeletonScreen({
  variant,
  count,
  columns = 4,
}: SkeletonScreenProps) {
  const { t } = useTranslation("common");
  const itemCount = count ?? (variant === "card-grid" ? 6 : 5);
  const isCardGrid = variant === "card-grid";

  const containerClass = isCardGrid ? "grid gap-lg" : "flex flex-col gap-sm";
  const containerStyle = isCardGrid
    ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
    : undefined;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t("ui.loadingContent")}
    >
      <div className={containerClass} style={containerStyle}>
        {Array.from({ length: itemCount }, (_, i) => (
          <div
            key={i}
            className={`im-shimmer motion-reduce:animate-none motion-reduce:bg-[color-mix(in_srgb,var(--surface-border)_40%,transparent)] w-full ${variantHeightClass[variant]}`}
          />
        ))}
      </div>
    </div>
  );
});
