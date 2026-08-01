import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TextField } from "./TextField";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  className?: string;
};

/** Password input with eye toggle for show/hide. */
export function PasswordField({ className, ...rest }: PasswordFieldProps) {
  const { t } = useTranslation("common");
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <TextField
        type={visible ? "text" : "password"}
        className={["pr-10", className ?? ""].filter(Boolean).join(" ")}
        {...rest}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={visible ? t("ui.hidePassword") : t("ui.showPassword")}
        className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-sm border-none bg-transparent p-1 text-text-secondary transition-colors hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)] hover:text-text-primary"
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? (
          <EyeOff size={16} strokeWidth={2} aria-hidden="true" />
        ) : (
          <Eye size={16} strokeWidth={2} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
