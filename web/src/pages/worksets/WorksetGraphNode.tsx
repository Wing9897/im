import { Fragment } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  pipelineLayerForColumn,
  pipelinePointHandleId,
  pipelinePointHandleTop,
  type PipelineBlock,
  type PipelineLayerId,
  type PipelinePoint,
} from "../../domain/worksets/worksetPipelineGraph";

export type WorksetGraphNodeData = {
  block: PipelineBlock;
  selectedPointId: string | null;
  overflowCount: number;
  expanded: boolean;
  onSelectPoint?: (point: PipelinePoint) => void;
  onOpenSettings?: (point: PipelinePoint) => void;
  onToggleOverflow?: () => void;
};

export type WorksetGraphNodeType = Node<WorksetGraphNodeData, "worksetBlock">;

export type WorksetGraphLayerZoneData = {
  layer: PipelineLayerId;
  titleKey: string;
};

export type WorksetGraphLayerZoneType = Node<WorksetGraphLayerZoneData, "layerZone">;

function stopNodePointer(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

/** Dark ComfyUI-style block: header + one port row per point. Not draggable. */
export function WorksetGraphNode({ data }: NodeProps<WorksetGraphNodeType>) {
  const { t } = useTranslation("workset");
  const { block, selectedPointId, overflowCount, expanded, onSelectPoint, onOpenSettings, onToggleOverflow } =
    data;
  const layer = pipelineLayerForColumn(block.column);

  return (
    <div
      className={`im-ws-graph-node nodrag nopan${block.points.length === 0 ? " is-empty" : ""}`}
      data-layer={layer}
      data-testid={`workset-graph-block-${block.kind}`}
    >
      {block.points.map((point, index) => {
        const top = pipelinePointHandleTop(index);
        return (
          <Fragment key={point.id}>
            <Handle
              type="target"
              position={Position.Left}
              id={pipelinePointHandleId(point.id, "in")}
              className="im-ws-graph-port im-ws-graph-port-in nodrag nopan"
              style={{ top }}
              isConnectable
              title={t("graphPortConnectAria")}
            />
            <Handle
              type="source"
              position={Position.Right}
              id={pipelinePointHandleId(point.id, "out")}
              className="im-ws-graph-port im-ws-graph-port-out nodrag nopan"
              style={{ top }}
              isConnectable
              title={t("graphPortConnectAria")}
            />
          </Fragment>
        );
      })}
      <div className="im-ws-graph-node-header">{t(block.titleKey)}</div>
      <div className="im-ws-graph-node-body">
        {block.points.length === 0 ? (
          <div className="im-ws-graph-empty" data-testid={`workset-graph-block-empty-${block.kind}`}>
            {t("graphBlockEmpty")}
          </div>
        ) : null}
        {block.points.map((point) => {
          const selected = selectedPointId === point.id;
          const className = [
            "im-ws-graph-point",
            "nodrag",
            "nopan",
            point.muted ? "is-muted" : "",
            selected ? "is-selected" : "",
            point.legalTarget ? "is-legal-target" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={point.id}
              className={className}
              data-legal-target={point.legalTarget ? "true" : undefined}
            >
              <button
                type="button"
                className="im-ws-graph-point-btn nodrag nopan"
                title={point.label}
                aria-pressed={selected}
                data-testid={`workset-graph-point-${point.kind}-${point.entityId}`}
                onPointerDown={stopNodePointer}
                onClick={() => onSelectPoint?.(point)}
              >
                {point.label}
              </button>
              <button
                type="button"
                className="im-ws-graph-point-settings nodrag nopan"
                aria-label={t("graphPointSettingsAria", { name: point.label })}
                title={t("graphPointSettingsAria", { name: point.label })}
                data-testid={`workset-graph-point-settings-${point.kind}-${point.entityId}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenSettings?.(point);
                }}
                onPointerDown={stopNodePointer}
              >
                <Settings size={12} strokeWidth={2.25} aria-hidden="true" />
              </button>
            </div>
          );
        })}
        {overflowCount > 0 ? (
          <button
            type="button"
            className="im-ws-graph-overflow nodrag nopan"
            data-testid={`workset-graph-overflow-${block.kind}`}
            aria-expanded={expanded}
            onPointerDown={stopNodePointer}
            onClick={() => onToggleOverflow?.()}
          >
            {expanded
              ? t("graphOverflowCollapse")
              : t("graphOverflowExpand", { count: overflowCount })}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Column band behind a pipeline layer — visual only. */
export function WorksetGraphLayerZone({ data }: NodeProps<WorksetGraphLayerZoneType>) {
  const { t } = useTranslation("workset");
  return (
    <div className={`im-ws-graph-zone is-${data.layer}`} data-testid={`workset-graph-zone-${data.layer}`}>
      <div className="im-ws-graph-zone-label">{t(data.titleKey)}</div>
    </div>
  );
}
