/** Borderless icon actions on item form field cells and the CV title line. */
export const itemFormIconButtonClass =
  "border-0 bg-transparent p-0.5 text-text-muted shadow-none outline-none ring-0 hover:text-text-primary disabled:opacity-50";

export const itemFormIconButtonDangerClass =
  "border-0 bg-transparent p-0.5 text-text-muted shadow-none outline-none ring-0 hover:text-error disabled:opacity-50";

/** Category + workset row — two equal columns on sm+. */
export const itemFormBelongingGridClass =
  "grid grid-cols-1 items-end gap-sm sm:grid-cols-2 sm:gap-md";

/** Belonging selects — fill grid cell, no artificial max-width cap. */
export const itemFormBelongingSelectWrapClass = "w-full min-w-0";

/** Vertical stack inside CV sections (grid + hints). */
export const itemFormSectionBodyClass = "flex min-w-0 flex-col gap-sm";

/** Muted empty-state copy under grids. */
export const itemFormEmptyHintClass =
  "m-0 text-caption leading-normal text-text-muted";

/** Secondary explanatory copy (callouts, save-first hints). */
export const itemFormSecondaryHintClass =
  "m-0 text-caption leading-normal text-text-secondary";

/** Attribute / extras field grid. */
export const itemFormAttributeGridClass =
  "grid grid-cols-1 items-start gap-x-sm gap-y-sm sm:grid-cols-2 xl:grid-cols-3";

/** Single attribute chip cell — soft fill, hairline border. */
export const itemFormAttributeChipClass =
  "relative min-w-0 rounded-md border border-surface-border/35 bg-[color-mix(in_srgb,var(--surface-raised)_28%,transparent)] px-sm py-1.5";

/** CV header inventory row — quantity/unit cluster. */
export const itemFormInventoryRowClass =
  "mt-1 flex flex-wrap items-end gap-x-md gap-y-xs sm:gap-x-lg";
