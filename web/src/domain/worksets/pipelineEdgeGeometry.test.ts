import { describe, expect, it } from "vitest";

import {
  PIPELINE_BEZIER_OFFSET,
  PIPELINE_BLOCK,
  PIPELINE_BLOCK_WIDTH,
  buildWorksetPipelineGraph,
  itemPointId,
  layoutPipelineFlow,
  pipelinePointHandleTop,
  routePipelineEdge,
  worksetPointId,
  type PipelineGraphLabels,
} from "./worksetPipelineGraph";

const labels: PipelineGraphLabels = {
  generalName: "一般",
  unassigned: "未歸屬",
  more: (count) => `另 ${count} 項`,
  assistant: "助手",
  timeline: "時間規劃",
  intel: "情報頁",
  notify: "通知",
  external: "外部接口",
};

function handlePos(
  node: { position: { x: number; y: number } },
  index: number,
  side: "in" | "out",
) {
  return {
    x: side === "out" ? node.position.x + PIPELINE_BLOCK_WIDTH : node.position.x,
    y: node.position.y + pipelinePointHandleTop(index),
  };
}

function expectedCubicPath(
  source: { x: number; y: number },
  target: { x: number; y: number },
): string {
  const dx = target.x - source.x;
  const offset = dx * PIPELINE_BEZIER_OFFSET;
  const fmt = (value: number) => {
    const rounded = Math.round(value * 100) / 100;
    return Object.is(rounded, -0) ? "0" : String(rounded);
  };
  return `M ${fmt(source.x)} ${fmt(source.y)} C ${fmt(source.x + offset)} ${fmt(source.y)} ${fmt(target.x - offset)} ${fmt(target.y)} ${fmt(target.x)} ${fmt(target.y)}`;
}

describe("pipelineEdgeGeometry", () => {
  it("routes L1→L3 item→workset as a single ComfyUI cubic (not around L2)", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "__user__", name: "一般", notifyEnabled: true, externalEnabled: true }],
      tasks: [],
      items: [{ id: "item-123", title: "123", worksetId: "__user__" }],
      sources: [],
      events: [],
      labels,
    });
    const flow = layoutPipelineFlow(graph);
    const items = flow.nodes.find((node) => node.id === PIPELINE_BLOCK.items);
    const worksets = flow.nodes.find((node) => node.id === PIPELINE_BLOCK.worksets);
    expect(items?.type).toBe("worksetBlock");
    expect(worksets?.type).toBe("worksetBlock");
    const itemIndex =
      items?.type === "worksetBlock"
        ? items.data.block.points.findIndex((point) => point.id === itemPointId("item-123"))
        : -1;
    const worksetIndex =
      worksets?.type === "worksetBlock"
        ? worksets.data.block.points.findIndex((point) => point.id === worksetPointId("__user__"))
        : -1;
    expect(itemIndex).toBeGreaterThanOrEqual(0);
    expect(worksetIndex).toBeGreaterThanOrEqual(0);

    const edge = flow.edges.find(
      (row) => row.id === `${itemPointId("item-123")}->${worksetPointId("__user__")}`,
    );
    expect(edge?.type).toBe("smoothstep");

    const source = handlePos(items!, itemIndex, "out");
    const target = handlePos(worksets!, worksetIndex, "in");
    const route = routePipelineEdge({ source, target });

    expect(route.path).toBe(expectedCubicPath(source, target));
    expect(route.path.match(/ C /g)).toHaveLength(1);
    expect(route.path).not.toMatch(/ L /);
    expect(PIPELINE_BEZIER_OFFSET).toBe(0.5);
  });

  it("uses the same handle-to-handle cubic for adjacent L2→L3 wires", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [{ id: "t1", name: "Scan", worksetId: "ws-1", outputAnalysisEvents: true }],
      items: [],
      sources: [],
      events: [],
      labels,
    });
    const flow = layoutPipelineFlow(graph);
    const tasks = flow.nodes.find((node) => node.id === PIPELINE_BLOCK.tasks);
    const worksets = flow.nodes.find((node) => node.id === PIPELINE_BLOCK.worksets);
    const edge = flow.edges.find((row) => row.id === `task:t1->${worksetPointId("ws-1")}`);
    expect(edge?.type).toBe("smoothstep");

    const source = handlePos(tasks!, 0, "out");
    const target = handlePos(worksets!, 0, "in");
    const route = routePipelineEdge({ source, target });
    expect(route.path).toBe(expectedCubicPath(source, target));
    expect(route.path.match(/ C /g)).toHaveLength(1);
  });

  it("keeps one cubic even when a card sits between the handles", () => {
    const source = { x: 170, y: 80 };
    const target = { x: 430, y: 90 };
    const route = routePipelineEdge({ source, target });
    expect(route.path).toBe(expectedCubicPath(source, target));
    expect(route.samples.some((point) => point.x > 200 && point.x < 380)).toBe(true);
  });
});
