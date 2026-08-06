import type { ReactNode } from "react";
import { FieldLabel } from "./FieldLabel";
import { formHelpClass } from "./pageTypography";

type SettingsRowLayout = "stack" | "inline";

interface SettingsRowProps {
  label: string;
  help?: string;
  children: ReactNode;
  htmlFor?: string;
  /** stack = label above control (default); inline = label/help left, control right */
  layout?: SettingsRowLayout;
  /** Tighter label→control gap for dense forms (Items). */
  dense?: boolean;
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
  layout = "stack",
  dense = false,
}: SettingsRowProps) {
  if (layout === "inline") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-lg">
        <div className="min-w-0">
          <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
          {help ? <p className={formHelpClass}>{help}</p> : null}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    );
  }

  return (
    <div className={dense ? "flex w-full min-w-0 flex-col gap-xs" : "flex w-full min-w-0 flex-col gap-sm"}>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
      {help ? <p className={formHelpClass}>{help}</p> : null}
    </div>
  );
}
