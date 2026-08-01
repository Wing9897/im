import type { ButtonHTMLAttributes } from "react";

type LinkButtonTone = "accent" | "muted";

interface LinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: LinkButtonTone;
}

const toneClass: Record<LinkButtonTone, string> = {
  accent: "text-accent hover:opacity-80",
  muted: "text-text-muted hover:text-text-secondary",
};

/** Inline text button — replaces `.ui-link-btn`. */
export function LinkButton({
  tone = "accent",
  className,
  type = "button",
  ...rest
}: LinkButtonProps) {
  const cls = [
    "inline-flex cursor-pointer items-center border-none bg-transparent p-0 font-[inherit] text-caption font-medium transition-opacity duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)] disabled:cursor-not-allowed disabled:opacity-50",
    toneClass[tone],
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <button type={type} className={cls} {...rest} />;
}
