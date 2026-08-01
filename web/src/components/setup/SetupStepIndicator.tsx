import { useTranslation } from "react-i18next";

export type SetupWizardStep = "choose" | "local" | "remote";
export type SetupIndicatorStepId = "choose" | "connect";

const STEPS: SetupIndicatorStepId[] = ["choose", "connect"];

const LABEL_KEY: Record<SetupIndicatorStepId, string> = {
  choose: "setup.stepChoose",
  connect: "setup.stepConnect",
};

function resolveIndicator(step: SetupWizardStep): {
  current: SetupIndicatorStepId;
  completed: ReadonlySet<SetupIndicatorStepId>;
} {
  if (step === "choose") {
    return { current: "choose", completed: new Set() };
  }
  return { current: "connect", completed: new Set<SetupIndicatorStepId>(["choose"]) };
}

interface SetupStepIndicatorProps {
  step: SetupWizardStep;
  onStepSelect: (id: SetupIndicatorStepId) => void;
  /**
   * Pure Web skips the host/client chooser — omit that rail step and treat
   * connect as the first visible stage.
   */
  omitChoose?: boolean;
  /** Accessible name for the step rail (defaults to setup.title). */
  navLabel?: string;
}

/** Lightweight choose → connect progress for first-run setup. */
export function SetupStepIndicator({
  step,
  onStepSelect,
  omitChoose = false,
  navLabel,
}: SetupStepIndicatorProps) {
  const { t } = useTranslation("common");
  const { current, completed } = resolveIndicator(step);
  const visibleSteps = omitChoose ? STEPS.filter((id) => id !== "choose") : STEPS;

  return (
    <nav aria-label={navLabel ?? t("setup.title")} data-testid="setup-step-indicator">
      <ol className="m-0 flex list-none items-center gap-1 p-0 sm:gap-sm">
        {visibleSteps.map((id, index) => {
          const isCurrent = id === current;
          const isComplete = completed.has(id);
          const canSelect = isComplete && !(omitChoose && id === "choose");
          const label = t(LABEL_KEY[id]);
          const number = index + 1;

          const markerCls = [
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold leading-none tabular-nums transition-[background,color,border-color] duration-[var(--im-duration-fast)] ease-[var(--im-easing-out)]",
            isCurrent
              ? "border border-accent bg-[color-mix(in_srgb,var(--accent)_16%,var(--surface-card))] text-accent"
              : isComplete
                ? "border border-[color-mix(in_srgb,var(--accent)_45%,var(--surface-border))] bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface-card))] text-accent"
                : "border border-surface-border bg-surface-card text-text-muted",
          ].join(" ");

          const labelCls = [
            "truncate text-caption leading-none",
            isCurrent ? "font-medium text-text-primary" : "text-text-muted",
            // Narrow: show only the current step label next to its number.
            isCurrent ? "inline" : "hidden sm:inline",
          ].join(" ");

          const itemInner = (
            <>
              <span className={markerCls} aria-hidden="true">
                {number}
              </span>
              <span className={labelCls}>{label}</span>
            </>
          );

          return (
            <li
              key={id}
              className="flex min-w-0 items-center gap-1 sm:gap-sm"
              aria-current={isCurrent ? "step" : undefined}
            >
              {index > 0 ? (
                <span
                  className="mx-0.5 h-px w-3 shrink-0 bg-surface-border sm:mx-1 sm:w-5"
                  aria-hidden="true"
                />
              ) : null}
              {canSelect ? (
                <button
                  type="button"
                  className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border-0 bg-transparent p-0.5 text-left font-[inherit] text-inherit cursor-pointer hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent)_35%,transparent)]"
                  onClick={() => onStepSelect(id)}
                  aria-label={label}
                >
                  {itemInner}
                </button>
              ) : (
                <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 p-0.5">
                  {itemInner}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
