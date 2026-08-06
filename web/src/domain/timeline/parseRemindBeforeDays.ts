/** Parse optional remind-before-days form string → API int | null. */
export function parseRemindBeforeDays(
  raw: string | null | undefined,
): number | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const days = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(days) || days < 0) {
    throw new Error("invalid remindBeforeDays");
  }
  return days;
}
