import type { ReactNode } from "react";
import { formGridClass } from "./pageTypography";

type FormStackGap = "lg" | "xl" | "2xl";

interface FormStackProps {
  children: ReactNode;
  /** xl = 20px field gap (default); lg = 16px; 2xl = 24px for settings section stacks. */
  gap?: FormStackGap;
  className?: string;
}

/** Vertical form field stack — prefer over ad-hoc `gap-[14px]`. */
export function FormStack({ children, gap = "lg", className }: FormStackProps) {
  const gapClass =
    gap === "2xl" ? "gap-2xl" : gap === "xl" ? "gap-xl" : "gap-lg";
  const cls = ["flex flex-col", gapClass, className ?? ""].filter(Boolean).join(" ");
  return <div className={cls}>{children}</div>;
}

interface FormGridProps {
  children: ReactNode;
  className?: string;
}

/** Two-column responsive form grid. */
export function FormGrid({ children, className }: FormGridProps) {
  const cls = [formGridClass, className ?? ""].filter(Boolean).join(" ");
  return <div className={cls}>{children}</div>;
}
