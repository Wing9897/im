import i18n from "../../i18n";
import type { AppLogEntry } from "../../types/logs";

type LogDetailsEnvelope = {
  messageKey?: unknown;
  messageParams?: unknown;
};

/**
 * Resolve a log row's display message for the current UI locale.
 *
 * Newer rows may store `messageKey` + `messageParams` in `details` JSON
 * (e.g. batch failure). Legacy rows fall back to the baked `message` string.
 */
export function resolveLogDisplayMessage(
  entry: Pick<AppLogEntry, "message"> & { details?: string | null },
): string {
  const fallback = entry.message ?? "";
  if (!entry.details) return fallback;
  try {
    const parsed = JSON.parse(entry.details) as LogDetailsEnvelope;
    if (typeof parsed.messageKey !== "string" || !parsed.messageKey) {
      return fallback;
    }
    const params =
      parsed.messageParams &&
      typeof parsed.messageParams === "object" &&
      !Array.isArray(parsed.messageParams)
        ? (parsed.messageParams as Record<string, unknown>)
        : {};
    return String(
      i18n.t(parsed.messageKey, {
        ...params,
        defaultValue: fallback,
      }),
    );
  } catch {
    return fallback;
  }
}
