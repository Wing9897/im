import type { ChannelWithAccount } from "../types";
import type { PickerLayout } from "./platformRegistry";

export function sortChannelsByName(channels: ChannelWithAccount[]): ChannelWithAccount[] {
  return channels.slice().sort((a, b) =>
    (a.channelName || a.platformId).localeCompare(b.channelName || b.platformId),
  );
}

export function filterChannelsByQuery(
  channels: ChannelWithAccount[],
  query: string,
): ChannelWithAccount[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return channels;
  return channels.filter((channel) => {
    const haystack = [
      channel.channelName,
      channel.platformId,
      channel.platform,
      channel.accountName ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export function channelDisplayLabel(channel: ChannelWithAccount): string {
  return channel.channelName?.trim() || channel.platformId;
}

/** Short secondary line — hostname for feeds, not full URL. */
function formatPickerHint(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const path =
      url.pathname && url.pathname !== "/"
        ? url.pathname.replace(/\/$/, "")
        : "";
    const compact = path ? `${url.hostname}${path}` : url.hostname;
    return compact.length > 48 ? `${compact.slice(0, 47)}…` : compact;
  } catch {
    return trimmed.length > 48 ? `${trimmed.slice(0, 47)}…` : trimmed;
  }
}

/** Secondary line under a picker row (URL for flat feeds, empty for account-tree rows). */
export function channelDisplayHint(
  channel: ChannelWithAccount,
  pickerLayout: PickerLayout,
): string {
  if (pickerLayout === "account-tree") return "";
  if (channel.platform === "rss" || channel.platform === "mqtt") {
    return formatPickerHint(channel.platformId);
  }
  const account = channel.accountName?.trim();
  return account && account !== channelDisplayLabel(channel) ? account : "";
}

export const PICKER_ACCOUNT_COLLAPSE_THRESHOLD = 8;
export const PICKER_PLATFORM_AUTO_EXPAND_MAX = 6;

export function countSelectedInChannels(
  channelIds: string[],
  channels: ChannelWithAccount[],
): number {
  const selected = new Set(channelIds);
  return channels.filter((ch) => selected.has(ch.id)).length;
}
