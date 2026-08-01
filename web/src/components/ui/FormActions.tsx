import type { ReactNode } from "react";

interface FormActionsProps {
  children: ReactNode;
  className?: string;
  /** When true, removes top margin (for inline use inside cards). */
  inline?: boolean;
}

/** Right-aligned footer actions row for settings / form pages. */
export function FormActions({ children, className, inline = false }: FormActionsProps) {
  const cls = [
    "flex flex-wrap items-center justify-end gap-lg",
    inline ? "mt-0" : "mt-2xl",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={cls}>{children}</div>;
}
