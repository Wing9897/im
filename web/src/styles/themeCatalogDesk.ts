/** Desk-family theme catalog entries. */

import type { ThemeDefinition } from "./themeTypes.ts";
import { DESK_MOTION, DESK_SHADOWS, accentWash } from "./themeCatalogShared.ts";

export const THEME_CATALOG_DESK: readonly ThemeDefinition[] = [
  {
      id: "command-center",
      name: "Agent Desk",
      family: "desk",
      texture: "grain",
      // Zinc near-black + live green + violet (not mono-grey)
      swatch: ["#0c0c0e", "#1e1f26", "#19c37d", "#8b8cf6", "#f4f4f5"],
      motion: DESK_MOTION,
      colors: {
        textPrimary: "#f4f4f5",
        textSecondary: "#a8a8b3",
        textMuted: "#71717a",
        textSubtle: "#52525b",
        accent: "#19c37d",
        accentPink: "#8b8cf6",
        info: "#60a5fa",
        success: "#4ade80",
        warning: "#f0b429",
        error: "#f87171",
        surfaceBase: "#0c0c0e",
        surfaceCard: "#1e1f26",
        surfaceBorder: "#3a3b45",
        surfaceOverlay: "#282930",
        peach: "#fb923c",
        lavender: "#a5b4fc",
        ...DESK_SHADOWS,
        surfaceGradient:
          "linear-gradient(180deg, color-mix(in srgb, #8b8cf6 4%, #1e1f26) 0%, #1e1f26 100%)",
        surfaceBorderAlpha: "color-mix(in srgb, var(--surface-border) 70%, transparent)",
        textOnAccent: "#052e1f",
        imPageGlow: accentWash("#19c37d", 7),
        platform: { default: "var(--accent)" },
        calendarDot: { event: "#19c37d", ongoing: "#60a5fa", ending: "#f0b429" },
      },
    },

  {
      id: "slate",
      name: "Slate",
      family: "desk",
      texture: "grain",
      // 石板：冷鋅灰底 + 鋼藍強調 + 琥珀點綴
      swatch: ["#0f1218", "#222836", "#3b82f6", "#f59e0b", "#e8eef8"],
      motion: DESK_MOTION,
      colors: {
        textPrimary: "#e8eef8",
        textSecondary: "#a8b4c8",
        textMuted: "#6e7c94",
        textSubtle: "#4e5a70",
        accent: "#3b82f6",
        accentPink: "#a78bfa",
        info: "#38bdf8",
        success: "#34d399",
        warning: "#f59e0b",
        error: "#f87171",
        surfaceBase: "#0f1218",
        surfaceCard: "#222836",
        surfaceBorder: "#364056",
        surfaceOverlay: "#2a3244",
        peach: "#fb923c",
        lavender: "#94a3b8",
        ...DESK_SHADOWS,
        surfaceGradient:
          "linear-gradient(180deg, color-mix(in srgb, #3b82f6 5%, #222836) 0%, #222836 100%)",
        surfaceBorderAlpha: "rgba(54, 64, 86, 0.75)",
        textOnAccent: "#0a1224",
        imPageGlow: accentWash("#3b82f6", 8),
        // Ongoing shifts to cyan: --info (#38bdf8) sits too close to the blue accent dot.
        calendarDot: { event: "#3b82f6", ongoing: "#22d3ee", ending: "#f59e0b" },
      },
    },

  {
      id: "obsidian",
      name: "Obsidian",
      family: "desk",
      texture: "ink",
      // 黑曜：深墨底 + 琥珀金 + 冷灰字
      swatch: ["#0a0a0c", "#26262c", "#d4a017", "#5b8cff", "#f4f4f5"],
      motion: DESK_MOTION,
      colors: {
        textPrimary: "#f4f4f5",
        textSecondary: "#c4c4c8",
        textMuted: "#8a8a90",
        textSubtle: "#5c5c64",
        accent: "#d4a017",
        accentPink: "#c47854",
        info: "#5b8cff",
        success: "#6aaa6a",
        warning: "#e0b040",
        error: "#d06060",
        surfaceBase: "#0a0a0c",
        surfaceCard: "#26262c",
        surfaceBorder: "#44444c",
        surfaceOverlay: "#323238",
        peach: "#e09060",
        lavender: "#8a8498",
        ...DESK_SHADOWS,
        surfaceGradient:
          "linear-gradient(180deg, color-mix(in srgb, #d4a017 4%, #26262c) 0%, #26262c 100%)",
        surfaceBorderAlpha: "rgba(68, 68, 76, 0.75)",
        textOnAccent: "#1a1408",
        imPageGlow: accentWash("#d4a017", 7),
        calendarDot: { event: "#d4a017", ongoing: "#5b8cff", ending: "#d06060" },
      },
    }
];
