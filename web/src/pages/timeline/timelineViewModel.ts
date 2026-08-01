import type { TFunction } from "i18next";

import type { TimelineItem } from "../../types";
import i18n from "../../i18n";

export interface TimelineEmptyHint {
  title: string;
  description: string;
}

type Translate = TFunction | typeof i18n.t;

function timelineT(key: string, t?: Translate): string {
  if (t) return String(t(key));
  return String(i18n.t(`timeline:${key}`));
}

/**
 * Hint when filters hide every event. A completely empty calendar stays quiet —
 * the grid itself is enough; no top banner.
 */
export function resolveTimelineEmptyHint(
  events: TimelineItem[],
  filteredEvents: TimelineItem[],
  _emptyState: string,
  t?: Translate,
): TimelineEmptyHint | null {
  if (events.length === 0) {
    return null;
  }
  if (filteredEvents.length === 0) {
    return {
      title: timelineT("empty.filteredTitle", t),
      description: timelineT("empty.filteredDescription", t),
    };
  }
  return null;
}
