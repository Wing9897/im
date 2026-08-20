import { captionClass } from "../../../components/ui/pageTypography";
import type { EventListCardMetaLookups } from "../../../domain/timeline/eventListCardMeta";
import type { TimelineItem } from "../../../types";
import { EventListItem } from "./EventListItem";

export function EventListGroup({
  title,
  events,
  focusedDay,
  onSelectEvent,
  testId,
  metaLookups,
}: {
  title: string;
  events: TimelineItem[];
  focusedDay: Date;
  onSelectEvent: (event: TimelineItem | null) => void;
  testId: string;
  metaLookups: EventListCardMetaLookups;
}) {
  if (events.length === 0) return null;
  return (
    <section className="flex min-w-0 shrink-0 flex-col gap-sm" data-testid={testId}>
      <div className="flex min-w-0 shrink-0 items-center gap-sm px-0.5">
        <h3 className={`${captionClass} m-0 shrink-0 font-medium text-text-secondary`}>
          {title}
        </h3>
        <div
          className="h-px min-w-0 flex-1 rounded-full bg-surface-border"
          aria-hidden="true"
          data-testid={`${testId}-divider`}
        />
      </div>
      {events.map((event) => (
        <EventListItem
          key={event.id}
          event={event}
          focusedDay={focusedDay}
          onSelectEvent={onSelectEvent}
          metaLookups={metaLookups}
        />
      ))}
    </section>
  );
}
