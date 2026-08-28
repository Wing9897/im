/** Block / point / handle ids for the household pipeline graph. */

export const PIPELINE_BLOCK = {
  sources: "block-sources",
  items: "block-items",
  tasks: "block-tasks",
  worksets: "block-worksets",
  assistant: "block-assistant",
  timeline: "block-timeline",
  intel: "block-intel",
  notify: "block-notify",
  external: "block-external",
} as const;

/** Layer-2 assistant is a real destination. L4 pages are a shared output legend. */
export const PIPELINE_PAGE = {
  assistant: "page:assistant",
  timeline: "page:timeline",
  intel: "page:intel",
  notify: "page:notify",
  external: "page:external",
} as const;

/** Single outbound port on the L3 工作集 block (not per-card). */
export const PIPELINE_LAYER_PORT = {
  worksets: "layer:worksets",
} as const;

export type PipelineOutputKind = "timeline" | "intel" | "notify" | "external";

export type PipelineOutputDef = {
  kind: PipelineOutputKind;
  blockId: (typeof PIPELINE_BLOCK)[PipelineOutputKind];
  pageId: (typeof PIPELINE_PAGE)[PipelineOutputKind];
  titleKey: "graphOutputTimeline" | "graphOutputIntel" | "graphOutputNotify" | "graphOutputExternal";
  href: string;
  labelKey: PipelineOutputKind;
};

/** L4: timeline / intel / local notify / actions — no MCP/A2A page nodes. */
export const PIPELINE_OUTPUT_DEFS: readonly PipelineOutputDef[] = [
  {
    kind: "timeline",
    blockId: PIPELINE_BLOCK.timeline,
    pageId: PIPELINE_PAGE.timeline,
    titleKey: "graphOutputTimeline",
    href: "/timeline",
    labelKey: "timeline",
  },
  {
    kind: "intel",
    blockId: PIPELINE_BLOCK.intel,
    pageId: PIPELINE_PAGE.intel,
    titleKey: "graphOutputIntel",
    href: "/intelligence",
    labelKey: "intel",
  },
  {
    kind: "notify",
    blockId: PIPELINE_BLOCK.notify,
    pageId: PIPELINE_PAGE.notify,
    titleKey: "graphOutputNotify",
    href: "/notify?tab=notify",
    labelKey: "notify",
  },
  {
    kind: "external",
    blockId: PIPELINE_BLOCK.external,
    pageId: PIPELINE_PAGE.external,
    titleKey: "graphOutputExternal",
    href: "/notify?tab=types",
    labelKey: "external",
  },
];

export function isPipelineLayerPortId(pointId: string): boolean {
  return pointId === PIPELINE_LAYER_PORT.worksets;
}

export function isPipelineOutputPageId(pointId: string): boolean {
  return PIPELINE_OUTPUT_DEFS.some((row) => row.pageId === pointId);
}

export const PIPELINE_HANDLE_IN_SUFFIX = "__in";
export const PIPELINE_HANDLE_OUT_SUFFIX = "__out";

export function pipelinePointHandleId(pointId: string, side: "in" | "out"): string {
  return `${pointId}${side === "in" ? PIPELINE_HANDLE_IN_SUFFIX : PIPELINE_HANDLE_OUT_SUFFIX}`;
}

export function worksetPointId(worksetId: string): string {
  return `workset:${worksetId}`;
}

export function taskPointId(taskId: string): string {
  return `task:${taskId}`;
}

export function itemPointId(itemId: string): string {
  return `item:${itemId}`;
}

export function sourcePointId(sourceId: string): string {
  return `source:${sourceId}`;
}
