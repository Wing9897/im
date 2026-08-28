/** Shared two-column board shell for Sources tabs (form + list). */

/** One panel surface for both panes (avoids left-opaque / right-glassier split). */
/* No overflow-hidden: it can kill backdrop-filter frosted glass under photo BG. */
export const sourceBoardClass =
  "im-surface-panel grid grid-cols-1 items-stretch rounded-xl border border-surface-border md:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]";

export const sourceBoardFormClass =
  "sticky top-md flex max-h-[calc(100vh-var(--app-top-bar-height,52px)-1.5rem)] min-h-0 flex-col self-start overflow-hidden border-b border-[color-mix(in_srgb,var(--surface-border)_85%,transparent)] bg-transparent md:border-b-0 md:border-r";

export const sourceBoardListClass = "flex min-w-0 flex-col bg-transparent";
