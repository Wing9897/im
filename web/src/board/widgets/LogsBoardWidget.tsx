import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { queryAppLogsPage } from "../../api/logs";
import { Badge, ListRowMain, ListRowMeta, ListRowTime } from "../../components/ui";
import {
  ANALYSIS_TRACE_KIND,
  filterAnalysisTraceLogs,
  readShowAnalysisTracePref,
} from "../../domain/logs/analysisTraceFilter";
import { resolveLogDisplayMessage } from "../../domain/logs/resolveLogDisplayMessage";
import type { AppLogEntryPayload } from "../../types";
import { levelTone } from "../../utils/logLevelTone";
import { formatOsDateTime } from "../../utils/time";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import type { BoardWidgetProps } from "../types";

/** Compact recent application logs for the ops board. */
export function LogsBoardWidget({ active = true }: BoardWidgetProps) {
  const { t } = useTranslation(["board", "logs"]);
  const showAnalysisTrace = readShowAnalysisTracePref();
  const fetcher = useCallback(
    () =>
      queryAppLogsPage({
        cursor: null,
        limit: 20,
        excludeKind: showAnalysisTrace ? undefined : ANALYSIS_TRACE_KIND,
      }).then((page) => page.logs),
    [showAnalysisTrace],
  );
  const { data: logs, error, loading, refresh } = useBoardWidgetPoll<AppLogEntryPayload[]>(
    fetcher,
    BOARD_POLL_MS.standard,
    { active },
  );
  const visibleLogs = useMemo(
    () => filterAnalysisTraceLogs(logs ?? [], showAnalysisTrace),
    [logs, showAnalysisTrace],
  );

  return (
    <div className="board-widget-body" data-testid="board-logs-widget">
      <BoardWidgetShell
        loading={loading && !logs}
        error={!logs ? error : null}
        onRetry={refresh}
        empty={Array.isArray(logs) && visibleLogs.length === 0}
        emptyLabel={t("board:logs.empty")}
      >
        {visibleLogs.length > 0 ? (
          <ul className="board-widget-list board-widget-list--logs">
            {visibleLogs.map((entry) => (
              <li key={entry.id} className="board-widget-list__item">
                <div
                  className="board-widget-list__row board-widget-list__row--logs"
                  data-testid={`board-logs-row-${entry.id}`}
                >
                  <div className="board-logs-row__line">
                    <ListRowTime dateTime={entry.time}>
                      {formatOsDateTime(entry.time)}
                    </ListRowTime>
                    <Badge tone={levelTone(entry.level)}>{entry.level.toUpperCase()}</Badge>
                    <ListRowMeta>
                      {t(`logs:category.${entry.category}`, { defaultValue: entry.category })}
                    </ListRowMeta>
                  </div>
                  <ListRowMain className="board-logs-msg">
                    {resolveLogDisplayMessage(entry)}
                  </ListRowMain>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </BoardWidgetShell>
    </div>
  );
}
