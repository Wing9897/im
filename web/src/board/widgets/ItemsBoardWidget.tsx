import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { fetchCalendarWindow } from "../../api/calendarWindow";
import {
  formatItemOccurrenceTitle,
  itemDateKindEmoji,
  itemDateKindMarkerClass,
} from "../../domain/items/itemCalendarProjection";
import { addDays, startOfDay } from "../../domain/timeline/dateUtils";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import type { BoardWidgetProps } from "../types";
import { getDateTimeLocale } from "../../i18n/locale";

type ItemRemindRow = {
  id: string;
  title: string;
  when: string;
  itemDateKind: string | null;
};

function formatWhen(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(getDateTimeLocale(), {
    month: "numeric",
    day: "numeric",
  });
}

async function fetchItemRemindSummary(): Promise<ItemRemindRow[]> {
  const start = startOfDay(new Date());
  const end = addDays(start, 30);
  const rows = await fetchCalendarWindow({
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    includeAnalysis: false,
    includeUser: false,
    includeRecurring: false,
    includeItems: true,
  });
  return rows.flatMap((row) => {
    if (row.source !== "item_remind" || !row.startTime) return [];
    return [
      {
        id: row.id,
        title: formatItemOccurrenceTitle(row.itemDateKind, row.title || ""),
        when: formatWhen(row.startTime),
        itemDateKind: row.itemDateKind ?? null,
      },
    ];
  }).slice(0, 12);
}

/** Item remind / expiry summary from calendar derive-on-read projections. */
export function ItemsBoardWidget({ active = true }: BoardWidgetProps) {
  const { t } = useTranslation();
  const fetcher = useCallback(() => fetchItemRemindSummary(), []);
  const { data: rows, error, loading, refresh } = useBoardWidgetPoll<ItemRemindRow[]>(
    fetcher,
    BOARD_POLL_MS.standard,
    { active },
  );

  return (
    <div className="board-widget-body" data-testid="board-items-widget">
      <BoardWidgetShell
        loading={loading && !rows}
        error={!rows ? error : null}
        onRetry={refresh}
        empty={Array.isArray(rows) && rows.length === 0}
        emptyLabel={t("board:items.empty")}
      >
        {rows && rows.length > 0 ? (
          <ul className="board-widget-list">
            {rows.map((row) => (
              <li key={row.id} className="board-widget-list__item">
                <div
                  className="board-widget-list__row"
                  data-testid={`board-items-row-${row.id}`}
                >
                  <span className="board-widget-list__title">
                    <span
                      className={itemDateKindMarkerClass(row.itemDateKind)}
                      aria-hidden="true"
                      data-testid={`board-items-kind-${row.id}`}
                    >
                      {itemDateKindEmoji(row.itemDateKind)}
                    </span>
                    <span className="board-widget-list__primary">{row.title}</span>
                  </span>
                  <span className="board-widget-list__meta">{row.when}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="board-widget-muted" data-testid="board-items-hint">
          {t("board:items.hint")}
        </p>
      </BoardWidgetShell>
    </div>
  );
}
