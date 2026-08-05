import type { Source } from "../types";
import type { ChannelWithSource } from "../types/channels";
import i18n from "../i18n";

/** Display label for a source using the canonical `name` field. */
export function formatSourceLabel(
  source: Pick<Source, "name">,
): string {
  const name = source.name?.trim();
  return name || String(i18n.t("ui.unnamedSource"));
}

/** Label for a channel's linked source (server-populated `sourceName`). */
export function formatChannelSourceLabel(
  channel: Pick<ChannelWithSource, "sourceName">,
): string {
  return channel.sourceName?.trim() || "";
}
