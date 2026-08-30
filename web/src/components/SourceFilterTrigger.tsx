import { ListFilter } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PillButton } from "./ui";

type SourceFilterTriggerProps = {
  open: boolean;
  isFiltering: boolean;
  filterBadgeCount: number;
  onOpen: () => void;
  prefix: string;
  variant?: "board" | "toolbar";
};

/** Shared filter pill for board tree + Timeline two-column dialogs. */
export function SourceFilterTrigger({
  open,
  isFiltering,
  filterBadgeCount,
  onOpen,
  prefix,
  variant = "toolbar",
}: SourceFilterTriggerProps) {
  const { t } = useTranslation("common");
  return (
    <PillButton
      active={open || isFiltering}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-pressed={isFiltering}
      aria-label={t("board:shell.sourceFilterSelectAria", { prefix })}
      title={t("board:shell.sourceFilterSelect")}
      onClick={onOpen}
      className={variant === "toolbar" ? "relative" : "relative size-8 p-0"}
      data-testid="board-source-filter"
    >
      <ListFilter size={16} strokeWidth={2.5} aria-hidden="true" />
      {isFiltering ? (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-0.5 text-[10px] font-semibold text-white"
          aria-hidden="true"
          data-testid="board-source-filter-count"
        >
          {filterBadgeCount}
        </span>
      ) : null}
    </PillButton>
  );
}
