import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { listActions } from "../../api/actions";
import { Badge } from "../../components/ui";
import { getDateTimeLocale } from "../../i18n/locale";
import type { Action } from "../../types";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import type { BoardWidgetProps } from "../types";

function formatTriggeredAt(value: string | null, neverLabel: string): string {
  if (!value) return neverLabel;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(getDateTimeLocale(), {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Compact automation-actions status list for the ops board. */
export function ActionsBoardWidget({ active = true }: BoardWidgetProps) {
  const { t } = useTranslation();
  const fetcher = useCallback(() => listActions(), []);
  const { data: actions, error, loading, refresh } = useBoardWidgetPoll<Action[]>(
    fetcher,
    BOARD_POLL_MS.standard,
    { active },
  );

  const items = (actions ?? []).slice(0, 12);

  return (
    <div className="board-widget-body" data-testid="board-actions-widget">
      <BoardWidgetShell
        loading={loading && !actions}
        error={!actions ? error : null}
        onRetry={refresh}
        empty={Array.isArray(actions) && actions.length === 0}
        emptyLabel={t("board.actions.empty")}
      >
        {items.length > 0 ? (
          <ul className="board-widget-list">
            {items.map((action) => (
              <li key={action.id} className="board-widget-list__item">
                <button
                  type="button"
                  className="board-widget-list__row"
                  data-testid={`board-actions-row-${action.id}`}
                >
                  <span className="board-widget-list__primary">
                    {action.name || t("board.common.unnamed")}
                    <Badge tone={action.isEnabled ? "success" : "neutral"}>
                      {action.isEnabled ? t("board.common.enabled") : t("board.common.disabled")}
                    </Badge>
                  </span>
                  <span className="board-widget-list__meta">
                    {action.actionType} ·{" "}
                    {formatTriggeredAt(action.lastTriggeredAt, t("board.actions.neverTriggered"))}
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
