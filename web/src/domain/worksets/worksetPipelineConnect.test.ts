import { describe, expect, it } from "vitest";

import {
  connectHintKey,
  isLegalConnectPair,
  legalConnectTargetIds,
  pipelinePairConnected,
  pipelinePointsFromConnection,
  pointIdFromPipelineHandle,
} from "./worksetPipelineConnect";
import {
  PIPELINE_PAGE,
  buildWorksetPipelineGraph,
  itemPointId,
  pipelinePointHandleId,
  sourcePointId,
  taskPointId,
  worksetPointId,
  type PipelineGraphLabels,
  type PipelinePoint,
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

function point(partial: PipelinePoint): PipelinePoint {
  return partial;
}

describe("worksetPipelineConnect", () => {
  const data = {
    worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: false }],
    tasks: [
      {
        id: "t1",
        name: "Scan",
        worksetId: "ws-1",
        outputAnalysisEvents: true,
        includeInTimeline: false,
        notifyPref: "off",
        channelIds: ["telegram:42"],
      },
    ],
    items: [{ id: "item-1", title: "Milk", worksetId: "ws-1" }],
    sources: [{ id: "src-1", name: "News" }],
    channels: [{ channelId: "telegram:42", sourceId: "src-1" }],
    events: [{ id: "ev-1", title: "Milk expires", worksetId: "ws-1", itemId: "item-1" }],
  };

  const task = point({
    id: taskPointId("t1"),
    kind: "task",
    entityId: "t1",
    label: "Scan",
    href: "/tasks/t1/edit",
  });
  const workset = point({
    id: worksetPointId("ws-1"),
    kind: "workset",
    entityId: "ws-1",
    label: "Ops",
    href: "/worksets/ws-1",
  });
  const source = point({
    id: sourcePointId("src-1"),
    kind: "source",
    entityId: "src-1",
    label: "News",
    href: "/sources",
  });
  const item = point({
    id: itemPointId("item-1"),
    kind: "item",
    entityId: "item-1",
    label: "Milk",
    href: "/items/item-1/edit",
  });
  const assistant = point({
    id: PIPELINE_PAGE.assistant,
    kind: "page",
    entityId: PIPELINE_PAGE.assistant,
    label: "助手",
    href: "/assistant",
  });
  const retiredIntel = point({
    id: "page:intel",
    kind: "page",
    entityId: "page:intel",
    label: "情報頁",
    href: "/intelligence",
  });

  it("allows only documented legal pairs", () => {
    expect(isLegalConnectPair(task, workset)).toBe(true);
    expect(isLegalConnectPair(workset, task)).toBe(true);
    expect(isLegalConnectPair(source, task)).toBe(true);
    expect(isLegalConnectPair(item, workset)).toBe(true);
    expect(isLegalConnectPair(workset, item)).toBe(true);
    expect(isLegalConnectPair(task, retiredIntel)).toBe(false);
    expect(
      isLegalConnectPair(workset, {
        id: "page:timeline",
        kind: "page",
        entityId: "page:timeline",
        label: "時間規劃",
        href: "/timeline",
      }),
    ).toBe(false);
    expect(isLegalConnectPair(task, assistant)).toBe(false);
    expect(isLegalConnectPair(assistant, workset)).toBe(true);
    expect(isLegalConnectPair(workset, assistant)).toBe(true);
    expect(isLegalConnectPair(source, workset)).toBe(false);
    expect(isLegalConnectPair(source, item)).toBe(false);
    expect(isLegalConnectPair(source, assistant)).toBe(false);
    expect(isLegalConnectPair(item, task)).toBe(false);
    expect(isLegalConnectPair(task, task)).toBe(false);
    expect(
      isLegalConnectPair(item, {
        id: "page:calendar",
        kind: "page",
        entityId: "page:calendar",
        label: "我的日程",
        href: "/timeline",
      }),
    ).toBe(false);
    expect(
      isLegalConnectPair(workset, {
        id: "page:calendar",
        kind: "page",
        entityId: "page:calendar",
        label: "我的日程",
        href: "/timeline",
      }),
    ).toBe(false);
  });

  it("highlights existing points of legal kinds", () => {
    const graph = buildWorksetPipelineGraph({ ...data, labels });
    const ids = legalConnectTargetIds(task, graph);
    expect(ids.has(worksetPointId("ws-1"))).toBe(true);
    expect(ids.has(sourcePointId("src-1"))).toBe(true);
    expect(ids.has("page:intel")).toBe(false);
    expect(legalConnectTargetIds(workset, graph).has("page:timeline")).toBe(false);
    expect(ids.has(PIPELINE_PAGE.assistant)).toBe(false);
    expect(ids.has(itemPointId("item-1"))).toBe(false);
    const itemIds = legalConnectTargetIds(item, graph);
    expect(itemIds.has(worksetPointId("ws-1"))).toBe(true);
    expect(itemIds.has("page:calendar")).toBe(false);
    expect(itemIds.has(taskPointId("t1"))).toBe(false);
    const assistantIds = legalConnectTargetIds(assistant, graph);
    expect(assistantIds.size).toBe(1);
    expect(assistantIds.has(worksetPointId("ws-1"))).toBe(true);
  });

  it("detects live ownership and subscription, not enable-state gates", () => {
    expect(pipelinePairConnected(task, workset, data)).toBe(true);
    expect(pipelinePairConnected(item, workset, data)).toBe(true);
    expect(pipelinePairConnected(source, task, data)).toBe(true);
    expect(pipelinePairConnected(task, retiredIntel, data)).toBe(false);
    expect(
      pipelinePairConnected(task, { ...retiredIntel, id: "page:timeline", entityId: "page:timeline" }, data),
    ).toBe(false);
    expect(
      pipelinePairConnected(
        workset,
        {
          id: "page:timeline",
          kind: "page",
          entityId: "page:timeline",
          label: "時間規劃",
          href: "/timeline",
        },
        data,
      ),
    ).toBe(false);
    expect(
      pipelinePairConnected(
        workset,
        {
          id: "page:notify",
          kind: "page",
          entityId: "page:notify",
          label: "通知",
          href: "/notify",
        },
        data,
      ),
    ).toBe(false);
    expect(
      pipelinePairConnected(
        workset,
        {
          id: "page:mcp",
          kind: "page",
          entityId: "page:mcp",
          label: "MCP",
          href: "/settings",
        },
        data,
      ),
    ).toBe(false);
    expect(
      pipelinePairConnected(
        workset,
        {
          id: "page:a2a",
          kind: "page",
          entityId: "page:a2a",
          label: "A2A",
          href: "/settings",
        },
        data,
      ),
    ).toBe(false);
    expect(pipelinePairConnected(assistant, workset, data)).toBe(false);
    expect(
      pipelinePairConnected(assistant, workset, { ...data, assistantDefaultWorksetId: "ws-1" }),
    ).toBe(true);
    expect(
      pipelinePairConnected(assistant, workset, { ...data, assistantDefaultWorksetId: "__general__" }),
    ).toBe(false);
  });

  it("uses a task-to-workset hint", () => {
    expect(connectHintKey(task)).toBe("graphConnectHintTask");
    expect(connectHintKey(source)).toBe("graphConnectHintSource");
    expect(connectHintKey(item)).toBe("graphConnectHintItem");
    expect(connectHintKey(assistant)).toBe("graphConnectHintAssistant");
  });

  it("maps handle ids back to point ids for onConnect", () => {
    expect(pointIdFromPipelineHandle(pipelinePointHandleId(task.id, "out"))).toBe(task.id);
    expect(pointIdFromPipelineHandle(pipelinePointHandleId(workset.id, "in"))).toBe(workset.id);
    expect(pointIdFromPipelineHandle("workset:__general____in")).toBe("workset:__general__");
    expect(pointIdFromPipelineHandle(null)).toBeNull();
  });

  it("resolves onConnect handles to pipeline points", () => {
    const graph = buildWorksetPipelineGraph({ ...data, labels });
    const legal = pipelinePointsFromConnection(
      {
        sourceHandle: pipelinePointHandleId(task.id, "out"),
        targetHandle: pipelinePointHandleId(workset.id, "in"),
      },
      graph,
    );
    expect(legal?.[0].id).toBe(task.id);
    expect(legal?.[1].id).toBe(workset.id);
    expect(isLegalConnectPair(legal![0], legal![1])).toBe(true);

    const illegal = pipelinePointsFromConnection(
      {
        sourceHandle: pipelinePointHandleId(source.id, "out"),
        targetHandle: pipelinePointHandleId(workset.id, "in"),
      },
      graph,
    );
    expect(illegal).not.toBeNull();
    expect(isLegalConnectPair(illegal![0], illegal![1])).toBe(false);
  });
});
