// ─── Spacing Scale ───────────────────────────────────────────────────────────

/** Raw spacing scale values (px) */
export const SPACING_VALUES = [0, 4, 8, 12, 16, 20, 24, 32, 48] as const;

/** Semantic spacing aliases */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 48,
} as const;

export type SpacingKey = keyof typeof spacing;

// ─── Border Radius ───────────────────────────────────────────────────────────

export const borderRadius = {
  sm: "6px",
  md: "8px",
  lg: "10px",
  xl: "12px",
  full: "999px",
} as const;

export type BorderRadiusKey = keyof typeof borderRadius;

// ─── Layout Width ────────────────────────────────────────────────────────────

export const layoutWidth = {
  narrow: 720,
  medium: 960,
  wide: 1280,
  horizontalPadding: 24,
} as const;

// ─── Layout ──────────────────────────────────────────────────────────────────

export const layout = {
  navbarHeight: "var(--app-top-bar-height, 48px)",
  navbarHeightPx: 48,
} as const;

export const fontFamily = {
  sans: '"Noto Sans TC", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"Inter", ui-monospace, monospace',
} as const;

// ─── Typography Scale ────────────────────────────────────────────────────────

export const typography = {
  display: { fontSize: 16, fontWeight: 700, lineHeight: 1.35, fontFamily: fontFamily.sans },
  h1: { fontSize: 16, fontWeight: 600, lineHeight: 1.35, fontFamily: fontFamily.sans },
  h2: { fontSize: 12, fontWeight: 600, lineHeight: 1.4, fontFamily: fontFamily.sans },
  body: { fontSize: 12, fontWeight: 400, lineHeight: 1.4, fontFamily: fontFamily.sans },
  caption: { fontSize: 10, fontWeight: 400, lineHeight: 1.35, fontFamily: fontFamily.sans },
  micro: { fontSize: 10, fontWeight: 400, lineHeight: 1.35, fontFamily: fontFamily.sans },
  dataMono: {
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1.4,
    fontFamily: fontFamily.mono,
    fontVariantNumeric: "tabular-nums" as const,
  },
} as const;

export type TypographyKey = keyof typeof typography;

/** Single-line levels that should truncate with ellipsis */
export const SINGLE_LINE_LEVELS: readonly TypographyKey[] = ["display", "h1"];

/** Multi-line levels that should wrap naturally */
export const MULTI_LINE_LEVELS: readonly TypographyKey[] = [
  "h2",
  "body",
  "caption",
  "micro",
  "dataMono",
];

// ─── Page Header Pattern ─────────────────────────────────────────────────────

export const pageHeader = {
  titleGap: spacing.xs,       // 4px between title and subtitle
  bottomMargin: spacing["3xl"], // 32px below header
  layout: "space-between" as const,
} as const;

// ─── Shadow / Elevation ──────────────────────────────────────────────────────

/**
 * Shadow tokens reference CSS custom properties so they adapt per-theme.
 * Desk/classic themes use black-based shadows; special themes use accent-tinted shadows.
 */
export const shadow = {
  sm: "var(--shadow-sm)",
  md: "var(--shadow-md)",
  lg: "var(--shadow-lg)",
  xl: "var(--shadow-xl)",
} as const;

export type ShadowKey = keyof typeof shadow;

// ─── Motion / Transitions ────────────────────────────────────────────────────

/** Duration tokens (milliseconds) — aligned with --im-duration-* in theme.css */
export const duration = {
  fast: 140,
  normal: 220,
  slow: 360,
} as const;

export type DurationKey = keyof typeof duration;

/** Easing tokens (CSS timing functions) — aligned with --im-easing-* */
export const easing = {
  default: "ease",
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  linear: "linear",
} as const;

export type EasingKey = keyof typeof easing;

// ─── Z-Index Scale ───────────────────────────────────────────────────────────


export const zIndex = {
  overlay: 1400,
  lightbox: 1600,
} as const;

export type ZIndexKey = keyof typeof zIndex;
