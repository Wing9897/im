import { useTranslation } from "react-i18next";

import { Badge } from "../ui";
import { itemDateKindLabel } from "../../domain/items/itemCalendarProjection";
import {
  EVENT_LIST_DAY_PHASE_TAG_CLASS,
  EVENT_LIST_DAY_PHASE_TAG_META,
  type EventListDayPhaseTag,
} from "../../domain/timeline/eventListCardMeta";

type Props = {
  showRemindBadge: boolean;
  dayPhaseTag: EventListDayPhaseTag | null;
  remindBadgeClassName?: string;
};

/** Shared remind + day-phase tags for list / week / day event cards. */
export function EventListPhaseBadges({
  showRemindBadge,
  dayPhaseTag,
  remindBadgeClassName = "normal-case tracking-normal shrink-0",
}: Props) {
  const { t } = useTranslation("timeline");
  if (!showRemindBadge && !dayPhaseTag) return null;
  return (
    <>
      {showRemindBadge ? (
        <Badge
          tone="warning"
          className={remindBadgeClassName}
          data-testid="timeline-remind-badge"
        >
          {itemDateKindLabel("remind")}
        </Badge>
      ) : null}
      {dayPhaseTag ? (
        <span
          className={EVENT_LIST_DAY_PHASE_TAG_CLASS}
          data-testid={EVENT_LIST_DAY_PHASE_TAG_META[dayPhaseTag].testId}
        >
          {t(EVENT_LIST_DAY_PHASE_TAG_META[dayPhaseTag].labelKey)}
        </span>
      ) : null}
    </>
  );
}
