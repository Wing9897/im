import type { ReactNode } from "react";
import { formHelpClass, sectionTitleClass } from "../../../components/ui";

/** Card-style section inside the notification create/edit dialog. */
export function ActionFormSection({
  title,
  note,
  children,
  step,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  /** Optional 1-based step badge for visual hierarchy. */
  step?: number;
}) {
  return (
    <section
      className="flex flex-col gap-md rounded-xl border border-surface-border/80 bg-[color-mix(in_srgb,var(--surface-card)_70%,transparent)] p-lg shadow-sm"
      aria-label={title}
    >
      <div className="flex items-start gap-md">
        {step != null ? (
          <span
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-caption font-semibold text-accent"
            aria-hidden="true"
          >
            {step}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className={`${sectionTitleClass} m-0`}>{title}</h3>
          {note ? <p className={`${formHelpClass} mt-1`}>{note}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-lg">{children}</div>
    </section>
  );
}
