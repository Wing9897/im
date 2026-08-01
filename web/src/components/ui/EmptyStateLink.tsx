import type { ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { buttonBaseClass, buttonSizeClass } from "./controlStyles";

interface EmptyStateLinkProps extends LinkProps {
  children: ReactNode;
}

/** Secondary link styled like a quiet button for EmptyState action slots. */
export function EmptyStateLink({ children, className, ...rest }: EmptyStateLinkProps) {
  const cls = [
    buttonBaseClass,
    buttonSizeClass.md,
    "inline-flex no-underline bg-transparent border-surface-border text-text-secondary enabled:hover:bg-[color-mix(in_srgb,var(--surface-card)_90%,transparent)] enabled:hover:border-surface-overlay enabled:hover:text-text-primary",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link className={cls} {...rest}>
      {children}
    </Link>
  );
}
