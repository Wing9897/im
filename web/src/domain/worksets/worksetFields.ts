/** Workset card glyph and description limits (stamp 3). */

export const WORKSET_DESCRIPTION_MAX = 280;

export function graphemeCount(text: string): number {
  const value = text.normalize();
  if (!value) return 0;
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)].length;
  }
  return [...value].length;
}

export function normalizeWorksetEmoji(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

export function normalizeWorksetDescription(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

export function isValidWorksetEmoji(raw: string | null | undefined): boolean {
  const cleaned = normalizeWorksetEmoji(raw);
  return cleaned === "" || graphemeCount(cleaned) === 1;
}
