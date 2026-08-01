import type { ReactNode } from "react";
import { statValueClass } from "./pageTypography";

interface StatsStripItem {
  label: string;
  value: ReactNode;
}

interface StatsStripProps {
  items: StatsStripItem[];
  className?: string;
}

/** Spaced metric tiles — 4 across on desktop with clear gaps between tiles. */
export function StatsStrip({ items, className }: StatsStripProps) {
  const cls = [
    "grid grid-cols-2 gap-sm lg:grid-cols-4",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-surface-border bg-surface-card px-md py-sm"
        >
          <span className="truncate text-card-meta font-medium text-text-muted">
            {item.label}
          </span>
          <span className={`truncate ${statValueClass}`}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
