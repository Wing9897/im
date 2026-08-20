import type { ReactNode } from "react";
import { SurfaceCard } from "../../../components/ui";
import { formHelpClass } from "../../../components/ui/pageTypography";

export function ChatEditorSection({
  step,
  title,
  subtitle,
  ariaLabel,
  testId,
  children,
}: {
  step?: number;
  title: string;
  subtitle?: string;
  ariaLabel: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <SurfaceCard
      material="panel"
      density="compact"
      className="shrink-0"
      aria-label={ariaLabel}
      role="region"
      data-testid={testId}
    >
      <div className="mb-sm flex items-start gap-sm">
        {step != null ? (
          <span
            className="mt-px inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[10px] font-semibold leading-none tabular-nums text-accent"
            aria-hidden="true"
          >
            {step}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="m-0 text-xs font-semibold tracking-wide text-text-secondary">{title}</h2>
          {subtitle ? <p className={`mt-xs mb-0 ${formHelpClass}`}>{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </SurfaceCard>
  );
}
