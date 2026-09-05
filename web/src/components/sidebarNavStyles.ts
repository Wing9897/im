export const sidebarNavLinkClass = (isActive: boolean) =>
  [
    "group relative flex min-h-8 cursor-pointer flex-row items-center rounded-md border border-transparent text-[12px] font-medium leading-tight text-text-secondary no-underline transition-[background,color] duration-150 ease-out [-webkit-app-region:no-drag] [pointer-events:auto]",
    "gap-2.5 px-2.5 py-1.5",
    isActive
      ? "bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] text-text-primary [&_svg]:text-accent"
      : "hover:bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)] hover:text-text-primary",
  ].join(" ");

export const railModeButtonClass = (active: boolean) =>
  [
    "inline-flex min-h-7 flex-1 items-center justify-center gap-1 rounded-md border-none text-[11px] font-medium transition-[background,color] duration-150",
    "px-1.5",
    active
      ? "bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] text-text-primary"
      : "bg-transparent text-text-muted hover:bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)] hover:text-text-primary",
  ].join(" ");
