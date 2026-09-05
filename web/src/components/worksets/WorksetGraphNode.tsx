import { Fragment } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  WORKSET_BLOCK_ICONS,
  WORKSET_GATE_ICON_PROPS,
  WORKSET_GATE_ICONS,
} from "../../domain/worksets/worksetGateIcons";
import {
  PIPELINE_HEADER_HEIGHT,
  PIPELINE_LAYER_PORT,
  isPipelineOutputBlockKind,
  isPipelineOutputPage,
  pipelineBlockShowsLayerOutPort,
  pipelineLayerForColumn,
  pipelinePointHandleId,
  pipelinePointHandleSides,
  pipelinePointHandleTop,
  type PipelineBlock,
  type PipelineGate,
  type PipelineGateKind,
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
  onToggleGate?: (point: PipelinePoint, kind: PipelineGateKind) => void;
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

const GATE_ARIA_KEYS: Record<
  PipelineGateKind,
  | "graphGateCalendarAria"
  | "graphGateCalendarWriteAria"
  | "graphGateNotifyAria"
  | "graphGateIntelAria"
  | "graphGateExternalAria"
> = {
  calendar: "graphGateCalendarAria",
  calendarWrite: "graphGateCalendarWriteAria",
  notify: "graphGateNotifyAria",
  intel: "graphGateIntelAria",
  external: "graphGateExternalAria",
};

function PointGate({
  gate,
  point,
  onToggleGate,
}: {
  gate: PipelineGate;
  point: PipelinePoint;
  onToggleGate?: (point: PipelinePoint, kind: PipelineGateKind) => void;
}) {
  const { t } = useTranslation("workset");
  const Icon = WORKSET_GATE_ICONS[gate.kind];
  const label = t(GATE_ARIA_KEYS[gate.kind], {
    name: point.label,
    state: t(gate.on ? "graphGateOn" : "graphGateOff"),
  });
  const className = `im-ws-graph-point-gate nodrag nopan${gate.on ? " is-on" : ""}`;
  const testId = `workset-graph-gate-${gate.kind}-${point.kind}-${point.entityId}`;
  const icon = (
    <Icon
      size={WORKSET_GATE_ICON_PROPS.size}
      strokeWidth={WORKSET_GATE_ICON_PROPS.strokeWidth}
      aria-hidden="true"
    />
  );
  if (!gate.toggleable) {
    return (
      <span className={className} title={label} aria-label={label} data-testid={testId} data-on={gate.on ? "true" : "false"}>
        {icon}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-pressed={gate.on}
      title={label}
      data-testid={testId}
      data-on={gate.on ? "true" : "false"}
      onClick={(event) => {
        event.stopPropagation();
        onToggleGate?.(point, gate.kind);
      }}
      onPointerDown={stopNodePointer}
    >
      {icon}
    </button>
  );
}

/** Dark ComfyUI-style block: header + one port row per point. Not draggable. */
export function WorksetGraphNode({ data }: NodeProps<WorksetGraphNodeType>) {
  const { t } = useTranslation("workset");
  const {
    block,
    selectedPointId,
    overflowCount,
    expanded,
    onSelectPoint,
    onOpenSettings,
    onToggleGate,
    onToggleOverflow,
  } = data;
  const layer = pipelineLayerForColumn(block.column);
  const BlockIcon = WORKSET_BLOCK_ICONS[block.kind];
  const outputBlock = isPipelineOutputBlockKind(block.kind);

  return (
    <div
      className={`im-ws-graph-node nodrag nopan${block.points.length === 0 ? " is-empty" : ""}${outputBlock ? " is-output-page" : ""}`}
      data-layer={layer}
      data-testid={`workset-graph-block-${block.kind}`}
    >
      {pipelineBlockShowsLayerOutPort(block.kind) ? (
        <Handle
          type="source"
          position={Position.Right}
          id={pipelinePointHandleId(PIPELINE_LAYER_PORT.worksets, "out")}
          className="im-ws-graph-port im-ws-graph-port-out im-ws-graph-port-layer nodrag nopan"
          style={{ top: PIPELINE_HEADER_HEIGHT / 2 }}
          isConnectable={false}
        />
      ) : null}
      {block.points.map((point, index) => {
        const top = pipelinePointHandleTop(index);
        const legendPage = isPipelineOutputPage(point);
        const handles = pipelinePointHandleSides(block.kind, point);
        return (
          <Fragment key={point.id}>
            {handles.in ? (
              <Handle
                type="target"
                position={Position.Left}
                id={pipelinePointHandleId(point.id, "in")}
                className="im-ws-graph-port im-ws-graph-port-in nodrag nopan"
                style={{ top }}
                isConnectable={!legendPage}
                title={legendPage ? undefined : t("graphPortConnectAria")}
              />
            ) : null}
            {handles.out ? (
              <Handle
                type="source"
                position={Position.Right}
                id={pipelinePointHandleId(point.id, "out")}
                className="im-ws-graph-port im-ws-graph-port-out nodrag nopan"
                style={{ top }}
                isConnectable
                title={t("graphPortConnectAria")}
              />
            ) : null}
          </Fragment>
        );
      })}
      <div className="im-ws-graph-node-header">
        <BlockIcon
          size={WORKSET_GATE_ICON_PROPS.size}
          strokeWidth={WORKSET_GATE_ICON_PROPS.strokeWidth}
          aria-hidden="true"
        />
        {t(block.titleKey)}
      </div>
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
              {(point.gates ?? []).map((row) => (
                <PointGate key={row.kind} gate={row} point={point} onToggleGate={onToggleGate} />
              ))}
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
