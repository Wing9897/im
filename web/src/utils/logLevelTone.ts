import type { BadgeTone } from "../components/ui";

const LEVEL_TONE: Record<string, BadgeTone> = {
  success: "success",
  warning: "warning",
  error: "danger",
  info: "info",
};

/** Map app-log level strings to Badge tones; unknown → neutral. */
export function levelTone(level: string): BadgeTone {
  return LEVEL_TONE[level] ?? "neutral";
}
