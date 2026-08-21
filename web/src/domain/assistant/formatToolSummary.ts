/**
 * Localize agent tool names and English wire ``resultSummary`` for UI.
 * Server ``summarize_tool_result`` stays English; this is display-only.
 */

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Human label for a wire tool name; falls back to the raw name. */
export function localizeToolName(name: string, t: Translate): string {
  const trimmed = name.trim();
  if (!trimmed) return name;
  return t(`toolNames.${trimmed}`, { defaultValue: trimmed });
}

function stripNamePrefix(name: string, summary: string): string {
  const prefix = `${name}: `;
  return summary.startsWith(prefix) ? summary.slice(prefix.length) : summary;
}

function countMatch(text: string, re: RegExp): number | null {
  const match = text.match(re);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Map English wire summaries (``3 items``, ``ok``, ``calendar.upcoming: 2 items``)
 * to locale copy. Unrecognized text is returned as-is (minus a redundant name prefix).
 */
export function formatToolResultSummary(
  name: string,
  summary: string | null | undefined,
  t: Translate,
): string {
  if (summary == null) return "";
  const raw = summary.trim();
  if (!raw) return "";
  const text = stripNamePrefix(name, raw);

  if (/^ok$/i.test(text)) return t("toolSummary.ok");
  if (/^dismissed$/i.test(text)) return t("toolSummary.dismissed");
  if (/^deleted$/i.test(text)) return t("toolSummary.deleted");
  if (/^taskConfig updated$/i.test(text)) return t("toolSummary.taskConfigUpdated");

  const error = text.match(/^error=(.+)$/i);
  if (error) return t("toolSummary.error", { error: error[1] });

  const task = text.match(/^task=(.+)$/i);
  if (task) return t("toolSummary.task", { id: task[1] });

  const inWindow = countMatch(text, /^(\d+)\s+events?\s+in window$/i);
  if (inWindow != null) return t("toolSummary.eventInWindow", { count: inWindow });

  const items = countMatch(text, /^(\d+)\s+items?$/i);
  if (items != null) return t("toolSummary.items", { count: items });

  const events = countMatch(text, /^(\d+)\s+events?$/i);
  if (events != null) return t("toolSummary.events", { count: events });

  const calendars = countMatch(text, /^(\d+)\s+calendars?$/i);
  if (calendars != null) return t("toolSummary.calendars", { count: calendars });

  const worksets = countMatch(text, /^(\d+)\s+worksets?$/i);
  if (worksets != null) return t("toolSummary.worksets", { count: worksets });

  const messages = countMatch(text, /^(\d+)\s+messages?$/i);
  if (messages != null) return t("toolSummary.messages", { count: messages });

  const results = text.match(/^(\d+)\s+results(?: via (\S+))?(?:\s+\((.*)\))?$/i);
  if (results) {
    const count = Number(results[1]);
    const provider = results[2];
    const titles = results[3];
    const base = provider
      ? t("toolSummary.resultsVia", { count, provider })
      : t("toolSummary.results", { count });
    return titles ? `${base} (${titles})` : base;
  }

  const page = text.match(/^(.+?)( truncated)? \((\d+) chars\)$/i);
  if (page) {
    const title = page[1];
    const chars = page[3];
    return page[2]
      ? t("toolSummary.pageTruncated", { title, chars })
      : t("toolSummary.pageChars", { title, chars });
  }

  return text;
}
