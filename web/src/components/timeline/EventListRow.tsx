import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui";
import {
  eventListAllowsDismiss,
  eventListTimeLabel,
  formatEventListAffiliationLabel,
  resolveEventCardDisplay,
  type EventListCardMetaLookups,
} from "../../domain/timeline/eventListCardMeta";
import type { TimelineItem } from "../../types";
import { EventListTitleMark } from "./EventListTitleMark";

type Props = {
  event: TimelineItem;
  metaLookups: EventListCardMetaLookups;
  focusedDay?: Date;
  selected?: boolean;
  onSelect?: () => void;
  onDismiss?: () => void;
  dismissBusy?: boolean;
  testId?: string;
  className?: string;
};

/**
 * Compact event row for board widgets and other dense lists.
 * Title mark + affiliation + time; optional dismiss (no confirm).
 */
export function EventListRow({
  event,
  metaLookups,
  focusedDay = new Date(),
  selected = false,
  onSelect,
  onDismiss,
  dismissBusy = false,
  testId,
  className,
}: Props) {
  const { t } = useTranslation(["timeline", "common"]);
  const { leading, title } = resolveEventCardDisplay(event, focusedDay);
  const timeLabel = eventListTimeLabel(event, t("timeline:userEvent.allDay"));
  const affiliationLabel = formatEventListAffiliationLabel(event, t, metaLookups);
  const allowDismiss = Boolean(onDismiss) && eventListAllowsDismiss(event);
  const rowClass = [
    "board-event-list-row",
    selected ? "board-event-list-row--selected" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const eventAvatarAria = useMemo(() => t("timeline:eventList.eventAvatarAria"), [t]);

  return (
    <div className={rowClass} data-testid={testId}>
      <button
        type="button"
        className="board-event-list-row__main"
        aria-pressed={selected || undefined}
        onClick={onSelect}
      >
        <EventListTitleMark
          event={event}
          leading={leading}
          metaLookups={metaLookups}
          eventAvatarAria={eventAvatarAria}
          markerClassName="board-event-list-row__mark"
        />
        <span className="board-event-list-row__body">
          <span className="board-event-list-row__title" title={title}>
            {title}
          </span>
          {affiliationLabel ? (
            <span className="board-event-list-row__affiliation" data-testid="board-event-list-affiliation">
              {affiliationLabel}
            </span>
          ) : null}
          <span className="board-event-list-row__time" data-testid="board-event-list-time">
            {timeLabel}
          </span>
        </span>
      </button>
      {allowDismiss ? (
        <Button
          type="button"
          variant="danger"
          size="icon"
          className="board-event-list-row__dismiss shrink-0"
          disabled={dismissBusy}
          aria-label={t("timeline:sidebar.dismiss")}
          title={t("timeline:sidebar.dismiss")}
          data-testid={`board-event-dismiss-${event.id}`}
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
            onDismiss?.();
          }}
        >
          <Trash2 size={14} strokeWidth={2.5} aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
