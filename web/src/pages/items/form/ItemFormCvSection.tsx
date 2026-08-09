import type { ReactNode } from "react";
import { captionClass } from "../../../components/ui";

/** Résumé section shell — hairline rule + compact heading, no dashed box. */
const cvSectionClass = "flex min-w-0 flex-col gap-sm py-sm first:pt-0 last:pb-0";

type Props = {
  title: string;
  hint?: string;
  testId?: string;
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
};

export function ItemFormCvSection({
  title,
  hint,
  testId,
  ariaLabel,
  children,
  className = "",
}: Props) {
  return (
    <section
      className={[cvSectionClass, className].filter(Boolean).join(" ")}
      aria-label={ariaLabel ?? title}
      data-testid={testId}
    >
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-xs gap-y-0 border-b border-surface-border/35 pb-1">
        <h3 className="m-0 shrink-0 text-caption font-semibold tracking-wide text-text-secondary">
          {title}
        </h3>
        {hint ? (
          <p
            className={`m-0 min-w-0 flex-1 truncate sm:flex-none ${captionClass}`}
            title={hint}
          >
            {hint}
          </p>
        ) : null}
      </div>
      <div className="min-w-0 pt-0.5">{children}</div>
    </section>
  );
}
