import { AlignLeft, CalendarDays, Clock, MapPin, Repeat } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { listUserEventsPage } from "../../api/userEvents";
import { listRecurringSeries } from "../../api/recurringSeries";
import { CardFieldRow, CardTitleIcon } from "../../components/ui";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import type { BoardWidgetProps } from "../types";
import { getDateTimeLocale } from "../../i18n/locale";
import { scheduleCardText } from "../../domain/schedule/scheduleCardFields";

type ScheduleSummary = {
  upcoming: Array<{
    id: string;
    title: string;
    when: string;
    location: string | null;
    notes: string | null;
  }>;
  series: Array<{
    id: string;
    name: string;
    active: boolean;
    location: string | null;
    notes: string | null;
  }>;
};

function ScheduleWidgetFieldRows({
  when,
  location,
  notes,
  emptyValue,
  locationLine,
  notesLine,
}: {
  when?: string;
  location: string | null;
  notes: string | null;
  emptyValue: string;
  locationLine: (value: string) => string;
  notesLine: (value: string) => string;
}) {
  const locationText = scheduleCardText(location, emptyValue);
  const notesText = scheduleCardText(notes, emptyValue);
  return (
    <>
      {when ? (
        <CardFieldRow icon={Clock} text={when} className="board-widget-list__meta" />
      ) : null}
      <CardFieldRow
        icon={MapPin}
        text={locationLine(locationText)}
        empty={locationText === emptyValue}
        className="board-widget-list__meta"
      />
      <CardFieldRow
        icon={AlignLeft}
        text={notesLine(notesText)}
        empty={notesText === emptyValue}
        className="board-widget-list__meta"
      />
    </>
  );
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(getDateTimeLocale(), {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchScheduleSummary(): Promise<ScheduleSummary> {
  const now = Date.now();
  const end = new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();
  const start = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const [eventsPage, seriesPage] = await Promise.all([
    listUserEventsPage({ start, end, limit: 8 }),
    listRecurringSeries({ limit: 8 }),
  ]);
  const upcoming = [...eventsPage.items]
    .sort(
      (a, b) =>
        new Date(a.startTime || 0).getTime() - new Date(b.startTime || 0).getTime(),
    )
    .slice(0, 6)
    .map((event) => ({
      id: event.id,
      title: event.title || "—",
      when: formatWhen(event.startTime),
      location: event.location ?? null,
      notes: event.body ?? null,
    }));
  const series = seriesPage.items.slice(0, 6).map((row) => ({
    id: row.id,
    name: row.name || "—",
    active: Boolean(row.isActive),
    location: row.eventLocation ?? null,
    notes: row.eventDescription ?? row.description ?? null,
  }));
  return { upcoming, series };
}

/** My schedule summary: upcoming one-shot events + recurring series. */
export function ScheduleBoardWidget({ active = true }: BoardWidgetProps) {
  const { t } = useTranslation(["board", "schedule"]);
  const emptyValue = t("schedule:card.empty");
  const fetcher = useCallback(() => fetchScheduleSummary(), []);
  const { data, error, loading, refresh } = useBoardWidgetPoll<ScheduleSummary>(
    fetcher,
    BOARD_POLL_MS.standard,
    { active },
  );

  const empty =
    Boolean(data) && data!.upcoming.length === 0 && data!.series.length === 0;

  return (
    <div className="board-widget-body" data-testid="board-schedule-widget">
      <BoardWidgetShell
        loading={loading && !data}
        error={!data ? error : null}
        onRetry={refresh}
        empty={empty}
        emptyLabel={t("board:schedule.empty")}
      >
        {data && !empty ? (
          <>
            {data.upcoming.length > 0 ? (
              <ul className="board-widget-list" data-testid="board-schedule-upcoming">
                {data.upcoming.map((row) => (
                  <li key={row.id} className="board-widget-list__item">
                    <div
                      className="board-widget-list__row"
                      data-testid={`board-schedule-event-${row.id}`}
                    >
                      <span className="board-widget-list__title">
                        <CardTitleIcon icon={CalendarDays} />
                        <span className="board-widget-list__primary">{row.title}</span>
                      </span>
                      <ScheduleWidgetFieldRows
                        when={row.when}
                        location={row.location}
                        notes={row.notes}
                        emptyValue={emptyValue}
                        locationLine={(value) => t("schedule:card.locationLine", { value })}
                        notesLine={(value) => t("schedule:card.notesLine", { value })}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            {data.series.length > 0 ? (
              <ul className="board-widget-list" data-testid="board-schedule-series">
                {data.series.map((row) => (
                  <li key={row.id} className="board-widget-list__item">
                    <div
                      className="board-widget-list__row"
                      data-testid={`board-schedule-series-${row.id}`}
                    >
                      <span className="board-widget-list__title">
                        <CardTitleIcon icon={Repeat} />
                        <span className="board-widget-list__primary">{row.name}</span>
                      </span>
                      <span className="board-widget-list__meta">
                        {row.active
                          ? t("board:common.enabled")
                          : t("board:common.disabled")}
                      </span>
                      <ScheduleWidgetFieldRows
                        location={row.location}
                        notes={row.notes}
                        emptyValue={emptyValue}
                        locationLine={(value) => t("schedule:card.locationLine", { value })}
                        notesLine={(value) => t("schedule:card.notesLine", { value })}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="board-widget-muted" data-testid="board-schedule-hint">
              {t("board:schedule.hint")}
            </p>
          </>
        ) : null}
        {empty ? (
          <p className="board-widget-muted" data-testid="board-schedule-hint">
            {t("board:schedule.hint")}
          </p>
        ) : null}
      </BoardWidgetShell>
    </div>
  );
}
