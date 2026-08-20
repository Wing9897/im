/** Which xyflow handles a household-pipeline card actually needs. */

import { isPipelineOutputBlockKind, type PipelineBlockKind, type PipelinePoint } from "./pipelineGraphTypes";

export type PipelineHandleSides = {
  in: boolean;
  out: boolean;
};

/**
 * View/layout ports only — hide sides that cannot carry a wire.
 *
 * - L1 來源／物品: outbound only (nothing connects in).
 * - L2 助手: outbound ownership only.
 * - L2 任務: sources in, workset out.
 * - L3 工作集: inbound ownership; L4 uses the block layer out-port, not per-card outs.
 * - L4 輸出頁: inbound legend only.
 * - Overflow "more" chips are not connectable.
 */
export function pipelinePointHandleSides(
  blockKind: PipelineBlockKind,
  point: PipelinePoint,
): PipelineHandleSides {
  if (point.kind === "more") return { in: false, out: false };

  if (blockKind === "sources" || blockKind === "items") {
    return { in: false, out: true };
  }
  if (blockKind === "assistant") {
    return { in: false, out: true };
  }
  if (blockKind === "tasks") {
    return { in: true, out: true };
  }
  if (blockKind === "worksets") {
    return { in: true, out: false };
  }
  if (isPipelineOutputBlockKind(blockKind)) {
    return { in: true, out: false };
  }
  return { in: true, out: true };
}

/** Single L3 → L4 source on the 工作集 header (not one circle per output page). */
export function pipelineBlockShowsLayerOutPort(blockKind: PipelineBlockKind): boolean {
  return blockKind === "worksets";
}
