/**
 * Short human-readable RRULE frequency label for schedule cards.
 */

export type RruleFreqKey = "daily" | "weekly" | "monthly" | "yearly" | "other";

export function rruleFreqKey(rrule: string | null | undefined): RruleFreqKey {
  const raw = (rrule ?? "").trim().toUpperCase();
  if (!raw) return "other";
  const match = /(?:^|;)FREQ=([A-Z]+)/.exec(raw);
  const freq = match?.[1] ?? "";
  if (freq === "DAILY") return "daily";
  if (freq === "WEEKLY") return "weekly";
  if (freq === "MONTHLY") return "monthly";
  if (freq === "YEARLY") return "yearly";
  return "other";
}
