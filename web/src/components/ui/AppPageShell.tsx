import type { CSSProperties, ReactNode } from "react";
import { pageShellRootClass } from "./pageLayout";

interface AppPageShellProps {
  actions?: ReactNode;
  children: ReactNode;
  /** standard = 1120px; fluid = full width with comfortable padding for data pages. */
  width?: "standard" | "fluid";
  className?: string;
  style?: CSSProperties;
}

const widthClass: Record<"standard" | "fluid", string> = {
  standard: "max-w-[1200px]",
  fluid: "max-w-[1280px]",
};

/** Centered page shell — compact toolbar + content (no hero title block). */
export function AppPageShell({
  actions,
  children,
  width = "standard",
  className,
  style,
}: AppPageShellProps) {
  const rootClass = [
    pageShellRootClass,
    widthClass[width],
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} style={style}>
      {actions != null ? (
        <header className="mb-md flex flex-wrap items-center justify-end gap-sm">
          {actions}
        </header>
      ) : null}
      {children}
    </div>
  );
}
