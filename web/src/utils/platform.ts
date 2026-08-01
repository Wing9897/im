import type { CSSProperties } from "react";
import type { ChannelWithAccount } from "../types";
import { PLATFORM_ORDER } from "./platformRegistry";

const KNOWN_CSS_VARS: Record<string, string> = {
  telegram: "var(--platform-telegram)",
  rss: "var(--platform-rss)",
  http: "var(--platform-http)",
  mqtt: "var(--platform-mqtt)",
  api: "var(--platform-api)",
  discord: "var(--platform-discord)",
  email: "var(--platform-email)",
};

const DEFAULT_COLOR = "var(--platform-default)";

export function platformColor(platform: string | null | undefined): string {
  if (!platform) return DEFAULT_COLOR;
  if (Object.hasOwn(KNOWN_CSS_VARS, platform)) return KNOWN_CSS_VARS[platform];
  return DEFAULT_COLOR;
}

export function groupChannelsByPlatform(
  channels: ChannelWithAccount[],
): [string, ChannelWithAccount[]][] {
  const map = new Map<string, ChannelWithAccount[]>();
  for (const channel of channels) {
    const group = map.get(channel.platform);
    if (group) group.push(channel);
    else map.set(channel.platform, [channel]);
  }

  const knownSet = new Set<string>(PLATFORM_ORDER);
  const knownEntries: [string, ChannelWithAccount[]][] = [];
  const unknownEntries: [string, ChannelWithAccount[]][] = [];

  for (const [platform, bucket] of map) {
    if (knownSet.has(platform)) knownEntries.push([platform, bucket]);
    else unknownEntries.push([platform, bucket]);
  }

  knownEntries.sort((a, b) => PLATFORM_ORDER.indexOf(a[0] as never) - PLATFORM_ORDER.indexOf(b[0] as never));
  unknownEntries.sort((a, b) => a[0].localeCompare(b[0]));

  return [...knownEntries, ...unknownEntries];
}

export function platformBadgeStyle(platform: string | null | undefined): CSSProperties {
  return {
    display: "inline-block",
    padding: "1px 6px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    background: platformColor(platform),
    color: "var(--surface-base)",
  };
}
