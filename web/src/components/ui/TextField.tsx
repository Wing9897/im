import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { controlBaseClass, controlSizeClass } from "./controlStyles";

const fieldBaseClass = `${controlBaseClass} ${controlSizeClass.md}`;

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
};

/** Select control sharing the same field chrome as TextField. */
export function SelectField({ className, children, ...rest }: SelectFieldProps) {
  const cls = [
    fieldBaseClass,
    // Extra right pad so the native caret does not clip the closed label.
    "appearance-auto pr-8 leading-none",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <select className={cls} {...rest}>
      {children}
    </select>
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
