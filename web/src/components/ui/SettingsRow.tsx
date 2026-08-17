import type { ReactNode } from "react";
import { FieldLabel } from "./FieldLabel";
import { formHelpClass } from "./pageTypography";

interface SettingsRowProps {
  label: string;
  help?: string;
  children: ReactNode;
  htmlFor?: string;
  /** Tighter label→control gap (item / category forms). */
  dense?: boolean;
  /**
   * `inline` = label + control on one row (compact switches / numbers / selects).
   * `stack` = label above control (long text, textareas).
   */
  layout?: "stack" | "inline";
  className?: string;
}

/**
 * Flat settings field row — no per-field SurfaceCard.
 * Wrap multiple rows in SettingsFieldGroup + SettingsContentCard.
 */
export function SettingsRow({
  label,
  help,
  children,
  htmlFor,
  dense = false,
  layout = "stack",
  className,
}: SettingsRowProps) {
  const stackGap = dense ? "gap-xs" : "gap-sm";
  if (layout === "inline") {
    return (
      <div
        className={["flex w-full min-w-0 flex-col", stackGap, className ?? ""]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="flex min-w-0 items-center gap-md">
          <FieldLabel className="mb-0 min-w-0 flex-1" htmlFor={htmlFor}>
            {label}
          </FieldLabel>
          {children}
        </div>
        {help ? <p className={formHelpClass}>{help}</p> : null}
      </div>
    );
  }
  return (
    <div
      className={["flex w-full min-w-0 flex-col", stackGap, className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
      {help ? <p className={formHelpClass}>{help}</p> : null}
    </div>
  );
}
