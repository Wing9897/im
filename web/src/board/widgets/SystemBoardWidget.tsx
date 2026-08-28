import { useTranslation } from "react-i18next";
import { Badge } from "../../components/ui";
import { useCollectorStatus } from "../../context/CollectorStatusContext";
import { getCollectorStatusLabelsShort } from "../../utils/collector";
import { formatAppVersionLabel } from "../../utils/appVersion";
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

/** Collector + AI engine health tiles for the ops board. */
export function SystemBoardWidget({}: BoardWidgetProps) {
  const { t } = useTranslation(["board", "settings"]);
  const { collectorStatus, aiEngineStatus } = useCollectorStatus();

  const aiLabel =
    aiEngineStatus === "available"
      ? t("board:system.aiAvailable")
      : aiEngineStatus === "unavailable"
        ? t("board:system.aiUnavailable")
        : t("board:system.aiUnknown");

  return (
    <div className="board-widget-body board-widget-system" data-testid="board-system-widget">
      <BoardWidgetShell>
        <div className="board-system-grid" data-testid="board-system-open">
          <div className="board-system-tile">
            <span className="board-system-tile__label">{t("board:system.collector")}</span>
            <Badge tone={collectorTone(collectorStatus)}>
              {getCollectorStatusLabelsShort()[collectorStatus]}
            </Badge>
          </div>
          <div className="board-system-tile">
            <span className="board-system-tile__label">{t("board:system.aiEngine")}</span>
            <Badge tone={aiTone(aiEngineStatus)}>{aiLabel}</Badge>
          </div>
        </div>
        <p
          className="board-widget-muted board-system-version"
          data-testid="board-system-version"
          title={t("settings:general.appVersionHelp")}
        >
          {formatAppVersionLabel()}
        </p>
      </BoardWidgetShell>
    </div>
  );
}
