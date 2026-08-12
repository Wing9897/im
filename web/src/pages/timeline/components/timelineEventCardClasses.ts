export function timelineEventCardClass(hovered: boolean): string {
  return [
    "im-surface-panel cursor-pointer rounded-md border border-solid p-md text-left text-caption text-text-primary transition-[border-color,box-shadow,transform] duration-150",
    hovered
      ? "-translate-y-px border-[color-mix(in_srgb,var(--accent)_35%,transparent)] shadow-sm"
      : "translate-y-0 border-surface-border shadow-none",
  ].join(" ");
}

export const timelineEventCardPrimaryRowClass =
  "mb-0.5 flex items-center justify-between gap-1.5 font-semibold opacity-100";

export const timelineEventCardTitleClass = "truncate";

export const timelineEventCardTimeClass =
  "shrink-0 text-card-meta text-text-muted";

export const timelineEventCardSummaryClass =
  "mb-0.5 truncate text-xs font-normal leading-snug text-text-secondary opacity-80";

export const timelineEventCardMetaClass =
  "text-card-meta font-normal opacity-60";
