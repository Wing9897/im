import { Badge } from "../../components/ui";
import { useCollectorStatus } from "../../context/CollectorStatusContext";
import { getCollectorStatusLabelsShort } from "../../utils/collector";
import i18n from "../../i18n";
import type { AiEngineStatus, CollectorStatus } from "../../types";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import type { BoardWidgetProps } from "../types";

function collectorTone(status: CollectorStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "running") return "success";
  if (status === "error") return "danger";
  return "neutral";
}

function aiTone(status: AiEngineStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "available") return "success";
  if (status === "unavailable") return "danger";
  return "neutral";
}

function aiLabel(status: AiEngineStatus): string {
  if (status === "available") return String(i18n.t("board:system.aiAvailable"));
  if (status === "unavailable") return String(i18n.t("board:system.aiUnavailable"));
  return String(i18n.t("board:system.aiUnknown"));
}

/** Collector + AI engine health tiles for the ops board. */
export function SystemBoardWidget({}: BoardWidgetProps) {
  const { collectorStatus, aiEngineStatus } = useCollectorStatus();

  return (
    <div className="board-widget-body board-widget-system" data-testid="board-system-widget">
      <BoardWidgetShell>
        <div
          className="board-system-grid"
          data-testid="board-system-open"
        >
          <div className="board-system-tile">
            <span className="board-system-tile__label">{String(i18n.t("board:system.collector"))}</span>
            <Badge tone={collectorTone(collectorStatus)}>
              {getCollectorStatusLabelsShort()[collectorStatus]}
            </Badge>
          </div>
          <div className="board-system-tile">
            <span className="board-system-tile__label">{String(i18n.t("board:system.aiEngine"))}</span>
            <Badge tone={aiTone(aiEngineStatus)}>{aiLabel(aiEngineStatus)}</Badge>
          </div>
        </div>
      </BoardWidgetShell>
    </div>
  );
}
