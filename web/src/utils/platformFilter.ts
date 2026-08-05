import type { Source, ChannelWithSource } from "../types";
import { PLATFORM_ORDER } from "./platformRegistry";

/** Unique platforms present in sources/channels, in registry order. */
export function uniquePlatformsFrom(
  sources: Source[],
  channels: ChannelWithSource[],
): string[] {
  const seen = new Set<string>();
  for (const source of sources) seen.add(source.platform);
  for (const channel of channels) seen.add(channel.platform);

  const order = new Set<string>(PLATFORM_ORDER);
  const known = PLATFORM_ORDER.filter((platform) => seen.has(platform));
  const unknown = Array.from(seen)
    .filter((platform) => !order.has(platform))
    .sort((a, b) => a.localeCompare(b));
  return [...known, ...unknown];
}

/** Platforms that have at least one channel (wall picker). */
export function uniquePlatformsFromChannels(channels: ChannelWithSource[]): string[] {
  return uniquePlatformsFrom([], channels);
}
