import type { ReactNode } from "react";
import { formGridClass } from "./pageTypography";

type FormStackGap = "md" | "lg" | "xl" | "2xl";

interface FormStackProps {
  children: ReactNode;
  /** md = 12px (desk-dense forms); lg = 16px (default); xl = 20px; 2xl = 24px. */
  gap?: FormStackGap;
  className?: string;
}

/** Vertical form field stack — prefer over ad-hoc `gap-[14px]`. */
export function FormStack({ children, gap = "lg", className }: FormStackProps) {
  const gapClass =
    gap === "2xl"
      ? "gap-2xl"
      : gap === "xl"
        ? "gap-xl"
        : gap === "md"
          ? "gap-md"
          : "gap-lg";
  const cls = ["flex w-full min-w-0 flex-col", gapClass, className ?? ""]
    .filter(Boolean)
    .join(" ");
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
