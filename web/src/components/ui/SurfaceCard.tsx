import type { HTMLAttributes, ReactNode } from "react";

export type SurfaceCardMaterial = "panel" | "elevated";
export type SurfaceCardDensity = "default" | "compact" | "field";
export type SurfaceCardEnter = boolean | "rise" | "rise-soft" | "glow";

type SurfaceCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** default = p-xl; compact = tighter padding for stat/metric cards; field = settings strategy row chrome. */
  density?: SurfaceCardDensity;
  /** Explicit padding control. ``none`` skips density padding (e.g. AccentBarCard). */
  padding?: "density" | "none";
  material?: SurfaceCardMaterial;
  /** Lightweight hover for clickable surfaces (any material/density). */
  interactive?: boolean;
  /** Optional enter animation (family CSS remaps rise → soft/glow on special themes). */
  enter?: SurfaceCardEnter;
};

const radiusClass: Record<SurfaceCardDensity, string> = {
  default: "rounded-lg",
  compact: "rounded-lg",
  field: "rounded-lg",
} as const;

const paddingClass: Record<SurfaceCardDensity, string> = {
  default: "p-card-inner",
  compact: "px-md py-sm",
  field: "px-md py-md",
} as const;

const materialClass: Record<SurfaceCardMaterial, string> = {
  panel: "im-material-panel",
  elevated: "im-material-elevated",
};

/** Matches Tailwind padding utilities (p-/px-/py-/pt-/pb-/pl-/pr-), including variant prefixes, so a caller's className can override the density default without fighting over generated CSS order. */
const PADDING_OVERRIDE_RE = /(?:^|\s)(?:[\w-]+:)*(?:p|px|py|pt|pb|pl|pr)-/;

const enterClass = (enter: SurfaceCardEnter | undefined): string => {
  if (!enter) return "";
  if (enter === true || enter === "rise") return "im-enter-rise";
  if (enter === "rise-soft") return "im-enter-rise-soft";
  return "im-enter-glow";
};

/**
 * Surface card — panel (frosted fill via --surface-panel) or elevated (sheen/texture).
 * Colors follow data-theme via semantic tokens; do not add bg-surface-card on this node.
 */
export function SurfaceCard({
  children,
  density = "default",
  padding = "density",
  material = "panel",
  interactive = false,
  enter,
  className,
  ...rest
}: SurfaceCardProps) {
  const hasPaddingOverride = className != null && PADDING_OVERRIDE_RE.test(className);
  const applyDensityPadding = padding === "density" && !hasPaddingOverride;

  /* Field density = compact border only; material always applies (--surface-panel). */
  const fieldBorder =
    density === "field"
      ? "border border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)]"
      : "";

  const interactiveClass = interactive ? "cursor-pointer im-card-hover" : "";

  const cls = [
    radiusClass[density],
    applyDensityPadding ? paddingClass[density] : "",
    fieldBorder,
    materialClass[material],
    interactiveClass,
    enterClass(enter),
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
