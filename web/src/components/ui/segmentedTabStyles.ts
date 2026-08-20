/** Shared visual classes for SegmentedTabs and SegmentedControl. */

export const segmentedNavClass = "mb-xl w-full";

/** Inline toolbar variant — no bottom margin, shrink to content width. */
export const segmentedNavInlineClass = "w-auto shrink-0";

export const segmentedTrackClass =
  "im-surface-chrome relative flex w-full gap-0.5 overflow-hidden rounded-md border border-surface-border p-0.5";

/** Compact track aligned to dense toolbar / form controls. */
export const segmentedTrackInlineClass =
  "im-surface-chrome relative inline-flex h-7 shrink-0 items-stretch gap-0.5 overflow-hidden rounded-md border border-surface-border p-0.5";

export const segmentedIndicatorClass =
  "pointer-events-none absolute top-0.5 bottom-0.5 left-0 z-[1] rounded-[5px] bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface-card))] shadow-[inset_0_1px_0_color-mix(in_srgb,#fff_8%,transparent)] transition-[transform,width] duration-200 ease-[var(--im-easing-out)] motion-reduce:transition-none";

export const segmentedTabClass =
  "relative z-[2] flex min-h-8 flex-1 items-center justify-center gap-1 rounded-[5px] border border-transparent px-sm py-1.5 text-xs font-medium text-text-secondary no-underline transition-[color,background] duration-200 ease-[var(--im-easing-out)] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color-mix(in_srgb,var(--accent)_24%,transparent)]";

export const segmentedTabInlineClass =
  "relative z-[2] flex h-full min-h-0 min-w-0 flex-none items-center justify-center gap-0.5 rounded-[5px] border border-transparent px-2 text-[10px] font-medium leading-none text-text-secondary no-underline transition-[color,background] duration-200 ease-[var(--im-easing-out)] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color-mix(in_srgb,var(--accent)_24%,transparent)]";

export const segmentedTabActiveClass = "text-text-primary";
