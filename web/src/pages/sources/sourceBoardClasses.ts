/** Shared two-column board shell for Sources tabs (form + list). */

export const sourceBoardClass =
  "grid grid-cols-1 items-stretch overflow-hidden rounded-xl border border-surface-border bg-[color-mix(in_srgb,var(--surface-card)_55%,transparent)] md:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]";

export const sourceBoardFormClass =
  "sticky top-md flex max-h-[calc(100vh-var(--app-top-bar-height,52px)-1.5rem)] min-h-0 flex-col self-start overflow-hidden border-b border-[color-mix(in_srgb,var(--surface-border)_85%,transparent)] md:border-b-0 md:border-r";

export const sourceBoardListClass = "flex min-w-0 flex-col";
