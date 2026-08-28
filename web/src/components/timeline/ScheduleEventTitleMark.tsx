import { CalendarDays, Repeat } from "lucide-react";

import { ItemEmojiAvatar } from "../items/emoji/ItemEmojiAvatar";
import { CardTitleIcon } from "../ui";
import {
  lookupScheduleEmoji,
  type ScheduleEmojiEventRef,
} from "../../domain/schedule/scheduleEmoji";

/** Title-row mark for day / sidebar schedule cards. Empty → CalendarDays / Repeat. */
export function ScheduleEventTitleMark({
  event,
}: {
  event: ScheduleEmojiEventRef;
}) {
  const glyph = lookupScheduleEmoji(event);
  if (glyph) {
    return (
      <span className="shrink-0" data-testid="schedule-event-emoji">
        <ItemEmojiAvatar emoji={glyph} size="md" />
      </span>
    );
  }
  return (
    <CardTitleIcon icon={event.source === "recurring" ? Repeat : CalendarDays} />
  );
}

/** Compact glyph for month / week / gantt chips. Empty → render nothing (caller keeps dots). */
export function ScheduleEventCompactEmoji({
  event,
  className = "",
}: {
  event: ScheduleEmojiEventRef;
  className?: string;
}) {
  const glyph = lookupScheduleEmoji(event);
  if (!glyph) return null;
  return (
    <span
      className={["shrink-0 leading-none", className].filter(Boolean).join(" ")}
      aria-hidden="true"
      data-testid="schedule-event-emoji"
    >
      {glyph}
    </span>
  );
}
