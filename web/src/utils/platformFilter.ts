import type { Account, ChannelWithAccount } from "../types";
import { PLATFORM_ORDER } from "./platformRegistry";

/** Unique platforms present in accounts/channels, in registry order. */
export function uniquePlatformsFrom(
  accounts: Account[],
  channels: ChannelWithAccount[],
): string[] {
  const seen = new Set<string>();
  for (const account of accounts) seen.add(account.platform);
  for (const channel of channels) seen.add(channel.platform);

  const order = new Set<string>(PLATFORM_ORDER);
  const known = PLATFORM_ORDER.filter((platform) => seen.has(platform));
  const unknown = Array.from(seen)
    .filter((platform) => !order.has(platform))
    .sort((a, b) => a.localeCompare(b));
  return [...known, ...unknown];
}

/** Platforms that have at least one channel (wall picker). */
export function uniquePlatformsFromChannels(channels: ChannelWithAccount[]): string[] {
  return uniquePlatformsFrom([], channels);
}
