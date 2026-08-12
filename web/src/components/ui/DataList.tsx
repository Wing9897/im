import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

interface DataListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** e.g. max-h-[65vh]; ignored when variant is flush */
  maxHeightClass?: string;
  /**
   * panel (default): bordered scroll box for dense pages (monitor/logs).
   * flush: no chrome — page scroll owns the feed (infinity-page layouts).
   */
  variant?: "panel" | "flush";
}

/** Scrollable compact list container — replaces bare `.ui-data-list` usage. */
export const DataList = forwardRef<HTMLDivElement, DataListProps>(function DataList(
  {
    children,
    className,
    maxHeightClass = "max-h-[65vh]",
    variant = "panel",
    ...rest
  },
  ref,
) {
  const cls =
    variant === "flush"
      ? ["min-w-0", className ?? ""].filter(Boolean).join(" ")
      : [
          "im-auto-scrollbar im-surface-panel overflow-y-auto overflow-x-hidden rounded-lg border border-[var(--surface-border-alpha,var(--surface-border))] shadow-sm",
          maxHeightClass,
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ");

  return (
    <div ref={ref} className={cls} {...rest}>
      {children}
    </div>
  );
});

interface DataListFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Centered load-more / pagination footer inside a DataList. */
export const DataListFooter = forwardRef<HTMLDivElement, DataListFooterProps>(
  function DataListFooter({ children, className, ...rest }, ref) {
    const cls = [
      "flex flex-col items-center gap-md border-t border-[color-mix(in_srgb,var(--surface-border)_40%,transparent)] px-lg py-lg text-center",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div ref={ref} className={cls} {...rest}>
        {children}
      </div>
    );
  },
);
