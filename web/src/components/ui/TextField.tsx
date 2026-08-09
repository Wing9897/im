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
 * Native `<select>` for **dense form rows** (settings, task editor, source forms).
 * Shares TextField chrome and paints a closed-state label overlay (Electron/Chromium
 * on Windows often fails to show native select text).
 *
 * Convention (progressive — no big-bang rewrite):
 * - Forms / settings rows → `SelectField` (this)
 * - Toolbar / page chrome / overflow-sensitive menus → `MenuSelect`
 *   (`menuPortal` + `useAnchoredMenu`)
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

export type OverlaySelectOption = {
  value: string;
  label: string;
};

type OverlaySelectFieldProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "children" | "onChange" | "value"
> & {
  className?: string;
  options: readonly OverlaySelectOption[];
  value: string;
  onChange: (value: string) => void;
  wrapperClassName?: string;
};

/** Options-array API — thin wrapper over {@link SelectField}. */
export function OverlaySelectField({
  className,
  options,
  value,
  onChange,
  disabled,
  wrapperClassName,
  ...rest
}: OverlaySelectFieldProps) {
  return (
    <SelectField
      {...rest}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className={className}
      wrapperClassName={wrapperClassName}
    >
      {options.map((option) => (
        <option key={option.value || "__empty__"} value={option.value}>
          {option.label}
        </option>
      ))}
    </SelectField>
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
