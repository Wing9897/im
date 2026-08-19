import { CalendarDays, Repeat } from "lucide-react";

import { ItemEmojiAvatar } from "../../../components/items/emoji/ItemEmojiAvatar";
import { CardTitleIcon } from "../../../components/ui";
import {
  lookupScheduleEmoji,
  type ScheduleEmojiEventRef,
} from "../../../domain/schedule/scheduleEmoji";
import type { ScheduleEmojiMap } from "../../schedule/scheduleEmojisStore";

/** Title-row mark for day / sidebar schedule cards. Empty → CalendarDays / Repeat. */
export function ScheduleEventTitleMark({
  event,
  emojis,
}: {
  event: ScheduleEmojiEventRef;
  emojis: ScheduleEmojiMap;
}) {
  const glyph = lookupScheduleEmoji(emojis, event);
  if (glyph) {
    return (
      <span className="shrink-0" data-testid="schedule-event-emoji">
        <ItemEmojiAvatar emoji={glyph} size="sm" />
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
  emojis,
  className = "",
}: {
  event: ScheduleEmojiEventRef;
  emojis: ScheduleEmojiMap;
  className?: string;
}) {
  const glyph = lookupScheduleEmoji(emojis, event);
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
