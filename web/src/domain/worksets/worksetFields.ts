/** Workset card description limits (current schema baseline). */

export const WORKSET_DESCRIPTION_MAX = 280;

export function normalizeWorksetDescription(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}
