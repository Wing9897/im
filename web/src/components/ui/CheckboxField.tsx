import type { InputHTMLAttributes, ReactNode } from "react";
import { formHelpClass } from "./pageTypography";

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  help?: string;
}

/** Labeled checkbox row for settings panels. */
export function CheckboxField({ label, help, className, id, ...rest }: CheckboxFieldProps) {
  const inputId = id ?? (typeof label === "string" ? `checkbox-${label}` : undefined);

  return (
    <div className="flex flex-col gap-sm">
      <label
        htmlFor={inputId}
        className="inline-flex cursor-pointer items-start gap-sm text-body text-text-primary"
      >
        <input
          type="checkbox"
          id={inputId}
          className={[
            "mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded-sm accent-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)]",
            className ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        />
        <span>{label}</span>
      </label>
      {help ? <p className={formHelpClass}>{help}</p> : null}
    </div>
  );
}
