import { useTranslation } from "react-i18next";

import { PillButton, SurfaceCard } from "../../../components/ui";
import { captionClass, cardTitleClass } from "../../../components/ui/pageTypography";
import { usePersistedState } from "../../../hooks/usePersistedState";
import type { TimelineItem } from "../../../types";
import { formatOsDateTime } from "../../../utils/time";
import { dismissedSurfaceClass, dismissedTitleClass } from "../timelineDismissUtils";
import { TIMELINE_EVENT_LIST_SHOW_ALL_STORAGE_KEY } from "../../../domain/prefs";

/** Collapse newlines/spaces for single-line list previews (line-clamp breaks on multi-line body). */
export function previewEventBody(body: string): string {
  return body.replace(/\s+/g, " ").trim();
}

/** Sub-component: event list with toggle between day-focused and full-range */
export function EventListPanel({
  rangeEvents,
  allRangeEvents,
  hasDayFocus,
  onSelectEvent,
}: {
  rangeEvents: TimelineItem[];
  allRangeEvents: TimelineItem[];
  hasDayFocus: boolean;
  onSelectEvent: (event: TimelineItem | null) => void;
}) {
  const { t } = useTranslation("timeline");
  /** Preference when a day is focused; full range always shows all events. */
  const [preferShowAll, setPreferShowAll] = usePersistedState(
    TIMELINE_EVENT_LIST_SHOW_ALL_STORAGE_KEY,
    false,
  );
  const showAll = !hasDayFocus || preferShowAll;

  const displayEvents = showAll ? allRangeEvents : rangeEvents;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-md overflow-hidden">
      {hasDayFocus && (
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <PillButton active={!showAll} onClick={() => setPreferShowAll(false)}>
            {t("eventList.day", { count: rangeEvents.length })}
          </PillButton>
          <PillButton active={showAll} onClick={() => setPreferShowAll(true)}>
            {t("eventList.allRange", { count: allRangeEvents.length })}
          </PillButton>
        </div>
      )}
      {!hasDayFocus && (
        <p className={`${captionClass} m-0 shrink-0 font-medium`}>
          {t("eventList.rangeEvents", { count: allRangeEvents.length })}
        </p>
      )}
      <div
        className="im-auto-scrollbar im-timeline-event-list flex min-h-0 min-w-0 flex-1 flex-col gap-sm overflow-x-hidden overflow-y-auto pr-0.5"
        data-testid="timeline-event-list-scroll"
      >
        {displayEvents.length === 0 ? (
          <p className={`${captionClass} m-0 shrink-0`}>{t("eventList.empty")}</p>
        ) : (
          displayEvents.map((event) => {
            const bodyPreview = event.body ? previewEventBody(event.body) : "";
            const dismissed = Boolean(event.dismissed);
            return (
              <SurfaceCard
                key={event.id}
                density="field"
                interactive
                className={`im-timeline-event-list-item min-w-0 shrink-0 cursor-pointer overflow-hidden p-md text-left ${
                  dismissed ? dismissedSurfaceClass : ""
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 w-full border-none bg-transparent p-0 text-left font-[inherit]"
                  onClick={() => onSelectEvent(event)}
                >
                  <div
                    className={`${cardTitleClass} min-w-0 truncate ${
                      dismissed ? dismissedTitleClass : ""
                    }`}
                    title={event.title}
                  >
                    {event.title}
                  </div>
                  {bodyPreview ? (
                    <div
                      className="mt-1 min-w-0 truncate text-xs leading-snug text-text-secondary"
                      title={event.body}
                    >
                      {bodyPreview}
                    </div>
                  ) : null}
                  <div className={`${captionClass} mt-1 min-w-0 truncate`}>
                    {formatOsDateTime(event.startTime, {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {event.endTime &&
                      ` – ${formatOsDateTime(event.endTime, {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`}
                  </div>
                </button>
              </SurfaceCard>
            );
          })
        )}
      </div>
    </div>
  );
}
