import type { LabelHTMLAttributes } from "react";
import { formLabelClass } from "./pageTypography";

interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** When true, uses the compact inline label style. */
  prominent?: boolean;
}

/** Standalone field label — replaces polishedFormLabelStyle. */
export function FieldLabel({
  prominent = false,
  className,
  children,
  ...rest
}: FieldLabelProps) {
  const base = prominent
    ? "block text-caption font-semibold text-text-primary"
    : `block ${formLabelClass}`;
  const cls = [base, className ?? ""].filter(Boolean).join(" ");
  return (
    <label className={cls} {...rest}>
      {children}
    </label>
  );
}
