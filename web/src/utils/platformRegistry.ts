/** Platform metadata for channel pickers and display (extensible registry). */

import i18n from "../i18n";

export type PickerLayout = "source-tree" | "flat";

/** i18n key under `common:platformScope.*` for the monitor scope noun. */
type PlatformScopeKey =
  | "source"
  | "channel"
  | "feed"
  | "url"
  | "broker"
  | "folder"
  | "endpoint";

export interface PlatformSpec {
  id: string;
  label: string;
  pickerLayout: PickerLayout;
  /** Noun key for the monitor scope unit (feed, channel, folder, …). */
  scopeLabelKey: PlatformScopeKey;
}

/**
 * Channel/platform display order for pickers and filters (includes wire id `api`).
 * Sources page tabs use `SOURCE_TAB_ORDER` instead.
 */
export const PLATFORM_ORDER = [
  "telegram",
  "discord",
  "rss",
  "http",
  "mqtt",
  "email",
  "api",
] as const;

const DEFAULT_SPEC: PlatformSpec = {
  id: "unknown",
  label: "Unknown",
  pickerLayout: "flat",
  scopeLabelKey: "source",
};

const PLATFORM_SPECS: Record<string, PlatformSpec> = {
  telegram: {
    id: "telegram",
    label: "Telegram",
    pickerLayout: "source-tree",
    scopeLabelKey: "channel",
  },
  discord: {
    id: "discord",
    label: "Discord",
    pickerLayout: "source-tree",
    scopeLabelKey: "channel",
  },
  rss: {
    id: "rss",
    label: "RSS",
    pickerLayout: "flat",
    scopeLabelKey: "feed",
  },
  http: {
    id: "http",
    label: "HTTP",
    pickerLayout: "flat",
    scopeLabelKey: "url",
  },
  mqtt: {
    id: "mqtt",
    label: "MQTT",
    pickerLayout: "flat",
    scopeLabelKey: "broker",
  },
  email: {
    id: "email",
    label: "Email",
    pickerLayout: "source-tree",
    scopeLabelKey: "folder",
  },
  api: {
    id: "api",
    label: "Webhook",
    pickerLayout: "flat",
    scopeLabelKey: "endpoint",
  },
};

export function getPlatformSpec(platform: string): PlatformSpec {
  return (
    PLATFORM_SPECS[platform] ?? {
      ...DEFAULT_SPEC,
      id: platform,
      label: platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : DEFAULT_SPEC.label,
    }
  );
}

export function platformDisplayLabel(platform: string | null | undefined): string {
  if (!platform) return DEFAULT_SPEC.label;
  return getPlatformSpec(platform).label;
}

/** Localized scope noun for channel/folder/feed pickers (follows UI locale). */
export function platformScopeLabel(platform: string | null | undefined): string {
  const key = getPlatformSpec(platform ?? "").scopeLabelKey;
  return String(i18n.t(`platformScope.${key}`));
}
