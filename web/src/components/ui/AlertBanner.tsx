import type { HTMLAttributes, ReactNode } from "react";

type AlertVariant = "warning" | "error" | "success" | "info";

interface AlertBannerProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  variant?: AlertVariant;
  children: ReactNode;
  role?: "status" | "alert";
}

const variantClass: Record<AlertVariant, string> = {
  warning:
    "border-[color-mix(in_srgb,var(--warning)_28%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-warning",
  error:
    "border-error bg-[color-mix(in_srgb,var(--error)_8%,transparent)] text-error",
  success:
    "border-[color-mix(in_srgb,var(--success)_28%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-success",
  info:
    "border-[color-mix(in_srgb,var(--info)_28%,transparent)] bg-[color-mix(in_srgb,var(--info)_10%,transparent)] text-info",
};

/** Inline status / error / success banner for workspace shells. */
export function AlertBanner({
  variant = "warning",
  children,
  className,
  role = "status",
  ...rest
}: AlertBannerProps) {
  const cls = [
    "mb-md flex items-start gap-1.5 rounded-md border px-md py-1.5 text-xs font-semibold break-words [overflow-wrap:anywhere]",
    variantClass[variant],
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} role={role} {...rest}>
      {children}
    </div>
  );
}
