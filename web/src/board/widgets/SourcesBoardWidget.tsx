import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { listSources } from "../../api/sources";
import { Badge } from "../../components/ui";
import { formatStatusLabel } from "../../styles/statusDot";
import type { Source, ConnectionStatus } from "../../types";
import { platformDisplayLabel } from "../../utils/platformRegistry";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import type { BoardWidgetProps } from "../types";

function statusTone(status: ConnectionStatus): "success" | "danger" | "neutral" {
  if (status === "connected") return "success";
  if (status === "error") return "danger";
  return "neutral";
}

/** Compact source status list for ops board. */
export function SourcesBoardWidget({ active = true }: BoardWidgetProps) {
  const { t } = useTranslation();
  const fetcher = useCallback(() => listSources(), []);
  const { data: sources, error, loading, refresh } = useBoardWidgetPoll<Source[]>(
    fetcher,
    BOARD_POLL_MS.standard,
    { active },
  );

  return (
    <div className="board-widget-body board-widget-sources" data-testid="board-sources-widget">
      <BoardWidgetShell
        loading={loading && !sources}
        error={!sources ? error : null}
        onRetry={refresh}
        empty={Array.isArray(sources) && sources.length === 0}
        emptyLabel={t("board.sources.empty")}
      >
        {sources && sources.length > 0 ? (
          <ul className="board-widget-list">
            {sources.map((source) => (
              <li key={source.id} className="board-widget-list__item">
                <button
                  type="button"
                  className="board-widget-list__row board-sources-row"
                  data-testid={`board-sources-row-${source.id}`}
                >
                  <span className="board-sources-row__title">
                    <span className="board-widget-list__primary">
                      {source.name || source.id}
                    </span>
                    <Badge tone="neutral" className="board-sources-row__platform">
                      {platformDisplayLabel(source.platform)}
                    </Badge>
                  </span>
                  <Badge tone={statusTone(source.status)}>
                    {formatStatusLabel(source.status)}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </BoardWidgetShell>
    </div>
  );
}
