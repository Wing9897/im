import React from "react";
import {
  EMPTY_STATE_ILLUSTRATIONS,
  type EmptyStateIllustrationKey,
} from "../../assets/illustrations/EmptyStateIllustrations";

interface EmptyStateProps {
  title: string;
  description?: string;
  hint?: string;
  actions?: React.ReactNode;
  compact?: boolean;
  /** Optional illustration rendered above the title */
  illustration?: React.ReactNode;
  /** Resolve an illustration from the shared map (overridden by `illustration`). */
  illustrationKey?: EmptyStateIllustrationKey;
  className?: string;
}

export const EmptyState = React.memo(function EmptyState({
  title,
  description,
  hint,
  actions,
  compact = false,
  illustration,
  illustrationKey,
  className,
}: EmptyStateProps) {
  const Illustration = illustrationKey ? EMPTY_STATE_ILLUSTRATIONS[illustrationKey] : null;
  const resolvedIllustration = illustration ?? (Illustration ? <Illustration /> : null);
  return (
    <div
      role="status"
      className={[
        "flex flex-col items-center justify-center text-center",
        compact ? "min-h-[160px] px-lg py-xl" : "min-h-[360px] rounded-lg px-4xl py-4xl",
        "bg-[radial-gradient(ellipse_at_50%_40%,color-mix(in_srgb,var(--accent)_3%,transparent),transparent_70%)]",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {resolvedIllustration ? (
        <div className="mb-lg flex h-16 w-16 items-center justify-center">{resolvedIllustration}</div>
      ) : null}
      <div className="max-w-[420px] text-section-title font-semibold leading-snug tracking-wide text-text-primary">
        {title}
      </div>
      {description ? (
        <div className="mt-sm max-w-[420px] text-body leading-normal text-text-secondary">
          {description}
        </div>
      ) : null}
      {hint ? (
        <div className="mt-md max-w-[420px] text-caption leading-[1.6] text-text-muted">{hint}</div>
      ) : null}
      {actions ? (
        <div
          className={[
            "flex flex-wrap justify-center gap-md",
            compact ? "mt-md" : "mt-xl",
          ].join(" ")}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
});
