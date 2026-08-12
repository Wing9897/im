import type { ReactNode } from "react";
import { statValueClass } from "./pageTypography";
import { SurfaceCard } from "./SurfaceCard";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  "data-testid"?: string;
}

/** Compact metric card used in page-level stats rows. */
export function StatCard({ label, value, hint, ...rest }: StatCardProps) {
  return (
    <SurfaceCard
      density="compact"
      material="panel"
      className="flex min-w-0 flex-col gap-0.5"
      {...rest}
    >
      <span className="text-card-meta font-semibold uppercase tracking-[0.02em] text-text-muted">
        {label}
      </span>
      <span className={`truncate ${statValueClass}`}>
        {value}
      </span>
      {hint != null ? (
        <span className="text-xs text-text-secondary">{hint}</span>
      ) : null}
    </SurfaceCard>
  );
}
