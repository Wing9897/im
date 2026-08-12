import type { ButtonHTMLAttributes, ReactNode } from "react";

interface CreateCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  label: ReactNode;
}

/** Dashed “add new” tile for grids — replaces `.ui-create-card`. */
export function CreateCard({ icon, label, className, type = "button", ...rest }: CreateCardProps) {
  const cls = [
    "im-enter-rise flex min-h-[132px] cursor-pointer flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-[color-mix(in_srgb,var(--surface-border)_75%,var(--text-muted))] bg-[color-mix(in_srgb,var(--surface-panel)_55%,transparent)] p-md text-center font-[inherit] text-[12px] text-text-muted transition-[border-color,color,background,box-shadow] duration-200 ease-out hover:border-[color-mix(in_srgb,var(--accent)_50%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent)_35%,transparent)] disabled:cursor-not-allowed disabled:opacity-50",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={cls} {...rest}>
      {icon != null ? (
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--surface-border)_70%,transparent)] bg-[color-mix(in_srgb,var(--surface-overlay)_35%,transparent)]">
          {icon}
        </span>
      ) : null}
      <span>{label}</span>
    </button>
  );
}
