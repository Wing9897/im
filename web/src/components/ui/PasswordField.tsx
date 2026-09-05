import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { surfaceOverlayHover60Class } from "./controlStyles";
import { TextField } from "./TextField";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  className?: string;
};

/** Password input with eye toggle for show/hide. */
export function PasswordField({ className, ...rest }: PasswordFieldProps) {
  const { t } = useTranslation("common");
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative flex w-full min-w-0">
      <TextField
        type={visible ? "text" : "password"}
        className={["min-w-0 flex-1 pr-10", className ?? ""].filter(Boolean).join(" ")}
        {...rest}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={visible ? t("ui.hidePassword") : t("ui.showPassword")}
        className={`absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-sm border-none bg-transparent p-1 text-text-secondary transition-colors ${surfaceOverlayHover60Class} hover:text-text-primary`}
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
