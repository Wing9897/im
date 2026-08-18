import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { PIPELINE_MAX_VISIBLE_WORKSETS } from "./pipelineConstants";

export type GraphWorksetRow = {
  id: string;
  updatedAt?: string | null;
};

function catalogOrderIds(worksets: readonly GraphWorksetRow[]): string[] {
  return worksets.map((row) => row.id);
}

function updatedAtKey(row: GraphWorksetRow): string {
  return row.updatedAt?.trim() || "";
}

/** Default checked set: all when ≤ cap; else 「一般」 plus most recently updated. */
export function defaultGraphWorksetIds(
  worksets: readonly GraphWorksetRow[],
  max = PIPELINE_MAX_VISIBLE_WORKSETS,
): string[] {
  if (worksets.length <= max) return catalogOrderIds(worksets);
  const ranked = [...worksets].sort((left, right) => {
    const leftSystem = left.id === SYSTEM_WORKSET_ID ? 0 : 1;
    const rightSystem = right.id === SYSTEM_WORKSET_ID ? 0 : 1;
    if (leftSystem !== rightSystem) return leftSystem - rightSystem;
    const byUpdated = updatedAtKey(right).localeCompare(updatedAtKey(left));
    if (byUpdated !== 0) return byUpdated;
    return left.id.localeCompare(right.id);
  });
  const picked = new Set(ranked.slice(0, max).map((row) => row.id));
  return catalogOrderIds(worksets).filter((id) => picked.has(id));
}

export function graphWorksetIdSetEquals(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}

/**
 * Resolve URL ids against the catalog. Missing / stale query → default.
 * Explicit empty (`[]`, from 清除) stays none. 全選 may exceed `max`.
 */
export function resolveGraphWorksetIds(
  parsed: readonly string[] | null,
  worksets: readonly GraphWorksetRow[],
  max = PIPELINE_MAX_VISIBLE_WORKSETS,
): string[] {
  const defaultIds = defaultGraphWorksetIds(worksets, max);
  if (parsed == null) return defaultIds;
  if (parsed.length === 0) return [];
  const known = new Set(catalogOrderIds(worksets));
  const seen = new Set<string>();
  for (const id of parsed) {
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
  }
  if (seen.size === 0) return defaultIds;
  return catalogOrderIds(worksets).filter((id) => seen.has(id));
}

export function toggleGraphWorksetId(
  selected: readonly string[],
  worksetId: string,
  catalog: readonly GraphWorksetRow[],
  max = PIPELINE_MAX_VISIBLE_WORKSETS,
): string[] {
  const catalogIds = catalogOrderIds(catalog);
  if (!catalogIds.includes(worksetId)) return [...selected];
  const next = new Set(selected);
  if (next.has(worksetId)) {
    next.delete(worksetId);
  } else {
    if (next.size >= max) return catalogIds.filter((id) => next.has(id));
    next.add(worksetId);
  }
  return catalogIds.filter((id) => next.has(id));
}

/** 全選: every catalog id, even when that exceeds the checkbox cap. */
export function selectAllGraphWorksetIds(worksets: readonly GraphWorksetRow[]): string[] {
  return catalogOrderIds(worksets);
}

/** 清除: none. Persisted via the existing `worksetId=__none__` query sentinel. */
export function clearGraphWorksetIds(): string[] {
  return [];
}
