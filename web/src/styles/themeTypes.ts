/** Theme types + motif list (shared by catalog / personalization / CSS gen). */

export type ThemeFamily = "desk" | "classic" | "special";
export type ThemeEnterStyle = "rise" | "rise-soft" | "glow";

/** Selective surface / page motifs (excludes flat `none`). */
export type ThemeMotif =
  | "grain"
  | "washi"
  | "moss"
  | "leaf"
  | "wood"
  | "wave"
  | "frost"
  | "ember"
  | "petal"
  | "mist"
  | "linen"
  | "grid"
  | "dune"
  | "ink";

export const THEME_MOTIFS: readonly ThemeMotif[] = [
  "grain",
  "washi",
  "moss",
  "leaf",
  "wood",
  "wave",
  "frost",
  "ember",
  "petal",
  "mist",
  "linen",
  "grid",
  "dune",
  "ink",
] as const;

export type ThemeTexture = ThemeMotif | "none";

export type ThemeMotion = {
  durationFast: string;
  durationNormal: string;
  easingOut: string;
  staggerStep: string;
  enter: ThemeEnterStyle;
};

export type ThemeColors = {
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accentPink: string;
  info: string;
  success: string;
  warning: string;
  error: string;
  surfaceBase: string;
  surfaceCard: string;
  surfaceBorder: string;
  surfaceOverlay: string;
  peach: string;
  lavender: string;
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  shadowXl: string;
  surfaceGradient: string;
  surfaceBorderAlpha: string;
  textOnAccent?: string;
  /** Special themes only */
  themeBg?: string;
  themeGlow?: string;
  glassBg?: string;
  glassBorder?: string;
  glassBlur?: string;
  /** Optional wall banner overrides (latte) */
  wallBanners?: Record<string, string>;
  platform?: Partial<{
    telegram: string;
    rss: string;
    http: string;
    mqtt: string;
    api: string;
    discord: string;
    email: string;
    default: string;
  }>;
  calendarDot?: Partial<{
    event: string;
    ongoing: string;
    ending: string;
  }>;
  /** Optional page canvas wash (defaults to accent mix in theme.css). */
  imPageGlow?: string;
};

export type ThemeDefinition = {
  id: string;
  name: string;
  family: ThemeFamily;
  light?: boolean;
  /** Special themes support custom BG upload (formerly anime). */
  special?: boolean;
  /**
   * Selective surface + page motif (buttons / bars / elevated; page when no custom BG).
   * Motifs are thematic (leaf / wood / wave / …); `none` = flat fills only.
   */
  texture?: ThemeTexture;
  gradient?: string;
  /** Five swatch hex colors derived from the palette (preview). */
  swatch: [string, string, string, string, string];
  colors: ThemeColors;
  motion: ThemeMotion;
};
