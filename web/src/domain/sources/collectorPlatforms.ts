/**
 * Collector platform ids — FE mirror of `server/domain/collector_platforms.py`.
 * Drift-tested against `COLLECTOR_PLATFORMS` / OpenAPI AccountPlatform.
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

export function isCollectorPlatform(value: string | null | undefined): value is CollectorPlatform {
  return (
    value != null &&
    (COLLECTOR_PLATFORM_ORDER as readonly string[]).includes(value)
  );
}
