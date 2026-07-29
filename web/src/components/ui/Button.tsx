import type { ButtonHTMLAttributes } from "react";
import { buttonBaseClass, buttonSizeClass, type ButtonSize } from "./controlStyles";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-accent border-accent text-[var(--text-on-accent)] font-medium enabled:hover:bg-[color-mix(in_srgb,var(--accent)_88%,var(--text-primary))] enabled:hover:shadow-[0_1px_0_color-mix(in_srgb,var(--text-primary)_18%,transparent)]",
  secondary:
    "im-texture-target bg-[color-mix(in_srgb,var(--surface-card)_88%,transparent)] border-surface-border text-text-primary enabled:hover:bg-surface-card enabled:hover:border-[color-mix(in_srgb,var(--surface-border)_80%,var(--accent))]",
  ghost:
    "bg-transparent border-transparent text-text-secondary enabled:hover:bg-[color-mix(in_srgb,var(--text-primary)_5%,transparent)] enabled:hover:text-text-primary",
  danger:
    "bg-transparent border-error/60 text-error enabled:hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]",
};

/**
 * Design-system button. Visuals use Tailwind utilities mapped to theme.css
 * CSS variables so every data-theme skins it automatically.
 */
export function Button({
  variant = "secondary",
  size = "md",
  className,
  type,
  ...rest
}: ButtonProps) {
  const cls = [buttonBaseClass, buttonSizeClass[size], variantClass[variant], className ?? ""]
    .filter(Boolean)
    .join(" ");
  return <button type={type ?? "button"} className={cls} {...rest} />;
}
