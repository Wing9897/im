/** Single-line preview truncation for compact board rows. */
export function truncateDisplayText(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  if (maxLength <= 1) return "…";
  return `${trimmed.slice(0, maxLength - 1)}…`;
}
