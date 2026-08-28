import { describe, expect, it } from "vitest";

import { buildWorksetPipelineGraph } from "./buildWorksetPipelineGraph";
import { isPipelineLayerPortId } from "./pipelineIds";
import { layoutPipelineFlow } from "./layoutPipelineFlow";
import {
  pipelineBlockShowsLayerOutPort,
  pipelinePointHandleSides,
} from "./pipelineHandleVisibility";
import type { PipelineBlockKind, PipelineGraphLabels, PipelinePoint } from "./pipelineGraphTypes";

function point(partial: Partial<PipelinePoint> & Pick<PipelinePoint, "id" | "kind">): PipelinePoint {
  return {
    entityId: partial.entityId ?? partial.id,
    label: partial.label ?? partial.id,
    href: partial.href ?? "/",
    ...partial,
  };
}

function sides(kind: PipelineBlockKind, row: PipelinePoint) {
  return pipelinePointHandleSides(kind, row);
}

describe("pipelinePointHandleSides", () => {
  it("hides L1 target ports; sources and items only emit right", () => {
    const source = point({ id: "source:src-1", kind: "source", entityId: "src-1" });
    const item = point({ id: "item:i1", kind: "item", entityId: "i1" });
    expect(sides("sources", source)).toEqual({ in: false, out: true });
    expect(sides("items", item)).toEqual({ in: false, out: true });
  });

  it("keeps task in+out and assistant out-only", () => {
    const task = point({ id: "task:t1", kind: "task", entityId: "t1" });
    const assistant = point({ id: "page:assistant", kind: "page", entityId: "page:assistant" });
    expect(sides("tasks", task)).toEqual({ in: true, out: true });
    expect(sides("assistant", assistant)).toEqual({ in: false, out: true });
  });

  it("keeps workset in ports and hides per-card outs (L4 uses the layer port)", () => {
    const general = point({ id: "workset:__general__", kind: "workset", entityId: "__general__" });
    expect(sides("worksets", general)).toEqual({ in: true, out: false });
    expect(pipelineBlockShowsLayerOutPort("worksets")).toBe(true);
    expect(pipelineBlockShowsLayerOutPort("tasks")).toBe(false);
  });

  it("hides L4 source ports; output pages only receive", () => {
    for (const kind of ["timeline", "intel", "notify", "external"] as const) {
      const page = point({ id: `page:${kind}`, kind: "page", entityId: `page:${kind}` });
      expect(sides(kind, page)).toEqual({ in: true, out: false });
    }
  });

  it("hides both sides on overflow chips", () => {
    const more = point({ id: "more:/tasks", kind: "more", entityId: "more" });
    expect(sides("tasks", more)).toEqual({ in: false, out: false });
    expect(sides("worksets", more)).toEqual({ in: false, out: false });
  });

  it("keeps every layout edge on a handle that remains visible", () => {
    const labels: PipelineGraphLabels = {
      generalName: "一般",
      unassigned: "未歸屬",
      more: (count) => `另 ${count} 項`,
      assistant: "助手",
      timeline: "時間規劃",
      intel: "情報頁",
      notify: "本機通知",
      external: "動作",
    };
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "__general__", name: "一般", notifyEnabled: true, externalEnabled: true }],
      tasks: [
        {
          id: "t1",
          name: "Scan",
          worksetId: "__general__",
          outputAnalysisEvents: true,
          channelIds: ["telegram:42"],
        },
      ],
      items: [{ id: "item-1", title: "Milk", worksetId: "__general__" }],
      sources: [{ id: "src-1", name: "News" }],
      channels: [{ channelId: "telegram:42", sourceId: "src-1" }],
      events: [],
      labels,
    });
    const flow = layoutPipelineFlow(graph);
    expect(flow.edges.length).toBeGreaterThan(0);
    for (const edge of graph.edges) {
      const sourceBlock = graph.blocks.find((block) => block.id === edge.sourceBlockId);
      const targetBlock = graph.blocks.find((block) => block.id === edge.targetBlockId);
      expect(sourceBlock).toBeTruthy();
      expect(targetBlock).toBeTruthy();
      if (isPipelineLayerPortId(edge.sourcePointId)) {
        expect(pipelineBlockShowsLayerOutPort(sourceBlock!.kind)).toBe(true);
      } else {
        const sourcePoint = sourceBlock!.points.find((row) => row.id === edge.sourcePointId);
        expect(sourcePoint).toBeTruthy();
        expect(pipelinePointHandleSides(sourceBlock!.kind, sourcePoint!).out).toBe(true);
      }
      const targetPoint = targetBlock!.points.find((row) => row.id === edge.targetPointId);
      expect(targetPoint).toBeTruthy();
      expect(pipelinePointHandleSides(targetBlock!.kind, targetPoint!).in).toBe(true);
    }
  });
});
