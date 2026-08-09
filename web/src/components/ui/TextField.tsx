import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Children, isValidElement, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { controlBaseClass, controlSizeClass } from "./controlStyles";

const fieldBaseClass = `${controlBaseClass} ${controlSizeClass.md}`;

function closedLabelTextClass(className?: string): string {
  if (className?.includes("text-caption")) return "text-caption";
  if (className?.includes("text-body")) return "text-body";
  return "text-body";
}

function labelFromOptionChildren(children: ReactNode, value: unknown): string {
  let match = "";
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || child.type !== "option") return;
    const optionValue = String(child.props.value ?? "");
    if (optionValue !== String(value ?? "")) return;
    const label = child.props.children;
    match = typeof label === "string" || typeof label === "number" ? String(label) : match;
  });
  return match;
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  className?: string;
};

/** Text / number input — themed via Tailwind controlStyles. */
export function TextField({ className, type = "text", ...rest }: TextFieldProps) {
  const cls = [fieldBaseClass, className ?? ""].filter(Boolean).join(" ");
  return <input type={type} className={cls} {...rest} />;
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  className?: string;
  wrapperClassName?: string;
};

/**
 * Native `<select>` for **dense form rows** that still need native select semantics.
 * Shares TextField chrome and paints a closed-state label overlay (Electron/Chromium
 * on Windows often fails to show native select text).
 *
 * Convention (progressive — no big-bang rewrite):
 * - Keep `SelectField` only where native `<select>` is required (optgroup, disabled
 *   `<option>`, form-submit quirks, or other native-only behavior).
 * - Toolbars / page chrome / ops bars / overflow-prone controls → `MenuSelect`
 *   (`variant="toolbar"` + `menuPortal` when clipped; never forces `w-full`).
 * - Settings / source dense rows that are a plain options list → prefer
 *   `MenuSelect variant="field"` (full-width form chrome, same density as Items belonging).
 */
export function SelectField({
  className,
  wrapperClassName,
  children,
  value,
  onChange,
  "data-testid": testId,
  ...rest
}: SelectFieldProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const reactLabel = useMemo(() => labelFromOptionChildren(children, value), [children, value]);
  const [closedLabel, setClosedLabel] = useState(() => reactLabel);

  const syncClosedLabel = useCallback(() => {
    const fromDom = selectRef.current?.selectedOptions[0]?.text ?? "";
    setClosedLabel(fromDom || reactLabel);
  }, [reactLabel]);

  useLayoutEffect(() => {
    setClosedLabel(reactLabel);
    syncClosedLabel();
  }, [value, children, reactLabel, syncClosedLabel]);

  const selectCls = [
    fieldBaseClass,
    "appearance-auto pr-8 leading-normal !text-transparent",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const wrapperCls = ["relative min-w-0", wrapperClassName ?? "w-full"].filter(Boolean).join(" ");
  const overlayCls = [
    "pointer-events-none absolute inset-y-0 left-sm right-8 z-[5] flex items-center truncate text-text-primary",
    closedLabelTextClass(className),
  ].join(" ");

  return (
    <div className={wrapperCls}>
      <select
        ref={selectRef}
        className={selectCls}
        value={value}
        onChange={(event) => {
          onChange?.(event);
          syncClosedLabel();
        }}
        data-testid={testId}
        {...rest}
      >
        {children}
      </select>
      <span aria-hidden="true" className={overlayCls} data-testid={testId ? `${testId}-label` : undefined}>
        {closedLabel}
      </span>
    </div>
  );
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  className?: string;
};

/** Multiline field; height defaults to auto with a sensible min. */
export function TextArea({ className, ...rest }: TextAreaProps) {
  const cls = [
    fieldBaseClass,
    "h-auto min-h-[120px] py-md resize-y leading-normal",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return <textarea className={cls} {...rest} />;
}
