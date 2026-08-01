import type React from "react";

import { platformColor } from "../../utils/platform";

export function leaderboardPlatformBadgeProps(platform: string): {
  className: string;
  style: React.CSSProperties;
} {
  return {
    className: "im-leaderboard-platform",
    style: { ["--lb-platform-color" as string]: platformColor(platform) },
  };
}
