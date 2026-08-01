import type { HTMLAttributes, ReactNode } from "react";

/** Monospace timestamp column — replaces `.ui-data-row-time`. */
export function ListRowTime({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLTimeElement> & { dateTime?: string }) {
  const cls = [
    "shrink-0 w-[140px] font-mono text-xs leading-snug text-text-muted",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <time className={cls} {...rest}>
      {children}
    </time>
  );
}

/** Secondary meta label — replaces `.ui-data-row-meta`. */
export function ListRowMeta({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement>) {
  const cls = [
    "shrink-0 text-[10px] font-semibold uppercase tracking-wide text-text-muted",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}

/** Primary content column with ellipsis — replaces `.ui-data-row-main`. */
export function ListRowMain({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement>) {
  const cls = [
    "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}

/** Inline detail sub-line inside ListRowMain — replaces `.ui-data-row-detail`. */
export function ListRowDetail({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement>) {
  const cls = [
    "ml-sm text-text-muted",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}

interface ListRowProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Shared row layout for compact data lists — replaces `.ui-data-row` grid cells. */
export function ListRow({ children, className, ...rest }: ListRowProps) {
  const cls = [
    "flex min-h-12 w-full items-center gap-lg border-b border-[color-mix(in_srgb,var(--surface-border)_40%,transparent)] px-list-row-x py-list-row-y text-body leading-snug text-text-primary last:border-b-0",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
