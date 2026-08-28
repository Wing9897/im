/** Workset card description limits (stamp 5). */

export const WORKSET_DESCRIPTION_MAX = 280;

export function normalizeWorksetDescription(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}
