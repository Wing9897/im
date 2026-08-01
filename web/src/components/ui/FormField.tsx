import { cloneElement, isValidElement, type ReactNode } from "react";

interface FormFieldProps {
  error?: string;
  children: ReactNode;
  className?: string;
}

const errorBorderClass = "border-error";

function cloneWithErrorBorder(child: ReactNode, errorClass: string): ReactNode {
  if (!isValidElement<{ className?: string }>(child)) {
    return child;
  }

  const cls = [child.props.className ?? "", errorClass].filter(Boolean).join(" ");
  return cloneElement(child, { className: cls });
}

/** Wraps a field control with optional validation error border + message. */
export function FormField({ error, children, className }: FormFieldProps) {
  const wrapCls = ["min-w-0", className ?? ""].filter(Boolean).join(" ");

  return (
    <div className={wrapCls}>
      {error ? cloneWithErrorBorder(children, errorBorderClass) : children}
      {error ? (
        <p className="mt-1 text-[11px] text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
