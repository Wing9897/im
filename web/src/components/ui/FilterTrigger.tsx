import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PillButton } from "./PillButton";
import { CountBadge } from "./CountBadge";

interface FilterTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Label text shown on the pill. */
  label: ReactNode;
  /** Optional selection count badge. */
  count?: number;
  active?: boolean;
}

/** Filter toolbar pill with optional count badge — replaces `.ui-filter-trigger`. */
export function FilterTrigger({
  label,
  count,
  active = false,
  className,
  type = "button",
  ...rest
}: FilterTriggerProps) {
  const { t } = useTranslation("common");
  const cls = ["inline-flex items-center gap-1.5", className ?? ""].filter(Boolean).join(" ");

  return (
    <PillButton type={type} active={active} className={cls} {...rest}>
      <span>{label}</span>
      {count != null && count > 0 ? (
        <CountBadge
          count={count}
          className="min-w-[18px] px-[5px] py-0 text-[11px]"
          aria-label={t("ui.filterActiveCount", { count })}
        />
      ) : null}
    </PillButton>
  );
}
