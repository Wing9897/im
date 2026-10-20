/**
 * Collector platform ids — FE mirror of `server/domain/collector_platforms.py`.
 * Drift-tested against `COLLECTOR_PLATFORMS` / OpenAPI SourcePlatform.
 */

export const COLLECTOR_PLATFORM_ORDER = [
  "telegram",
  "discord",
  "rss",
  "http",
  "mqtt",
  "email",
] as const;

export type CollectorPlatform = (typeof COLLECTOR_PLATFORM_ORDER)[number];
