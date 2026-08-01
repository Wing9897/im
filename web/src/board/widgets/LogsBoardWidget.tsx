import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { queryAppLogsPage } from "../../api/logs";
import { Badge } from "../../components/ui";
import { getDateTimeLocale } from "../../i18n/locale";
import { resolveLogDisplayMessage } from "../../domain/logs/resolveLogDisplayMessage";
import type { AppLogEntryPayload } from "../../types";
import { levelTone } from "../../utils/logLevelTone";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import type { BoardWidgetProps } from "../types";

function formatLogTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString(getDateTimeLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Compact recent application logs for the ops board. */
export function LogsBoardWidget({ active = true }: BoardWidgetProps) {
  const { t } = useTranslation();
  const fetcher = useCallback(
    () =>
      queryAppLogsPage({ cursor: null, limit: 20 }).then((page) => page.logs),
    [],
  );
  const { data: logs, error, loading, refresh } = useBoardWidgetPoll<AppLogEntryPayload[]>(
    fetcher,
    BOARD_POLL_MS.standard,
    { active },
  );

  return (
    <div className="board-widget-body" data-testid="board-logs-widget">
      <BoardWidgetShell
        loading={loading && !logs}
        error={!logs ? error : null}
        onRetry={refresh}
        empty={Array.isArray(logs) && logs.length === 0}
        emptyLabel={t("board.logs.empty")}
      >
        {logs && logs.length > 0 ? (
          <ul className="board-widget-list">
            {logs.map((entry) => (
              <li key={entry.id} className="board-widget-list__item">
                <button
                  type="button"
                  className="board-widget-list__row"
                  data-testid={`board-logs-row-${entry.id}`}
                >
                  <span className="board-widget-list__primary">
                    <Badge tone={levelTone(entry.level)}>{entry.level}</Badge>
                    <span className="board-logs-msg">
                      {resolveLogDisplayMessage(entry)}
                    </span>
                  </span>
                  <span className="board-widget-list__meta">
                    {entry.category} · {formatLogTime(entry.time)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </BoardWidgetShell>
    </div>
  );
}
