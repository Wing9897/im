import type { LabelHTMLAttributes } from "react";
import { formLabelClass } from "./pageTypography";

interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** When true, uses the compact inline label style. */
  prominent?: boolean;
  /** Append a required asterisk (not forwarded to the DOM). */
  required?: boolean;
  /** Tooltip on the asterisk (e.g. localized “required”). */
  requiredTitle?: string;
}

/** Standalone field label — replaces polishedFormLabelStyle. */
export function FieldLabel({
  prominent = false,
  required = false,
  requiredTitle,
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
      {required ? (
        <span className="ms-0.5 text-error" aria-hidden="true" title={requiredTitle}>
          *
        </span>
      ) : null}
    </label>
  );
}
