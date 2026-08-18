import { CalendarDays } from "lucide-react";
import { timelineEmptyHintClass } from "../timelineViewLayout";
import type { TimelineEmptyHint as TimelineEmptyHintModel } from "../timelineViewModel";

interface TimelineEmptyHintProps {
  hint: TimelineEmptyHintModel;
}

export function TimelineEmptyHint({ hint }: TimelineEmptyHintProps) {
  return (
    <div className={timelineEmptyHintClass} data-testid="timeline-empty-hint" role="status">
      <CalendarDays size={12} strokeWidth={2.25} className="shrink-0 text-text-muted" aria-hidden />
      <strong className="font-semibold text-text-primary">{hint.title}</strong>
      <span>{hint.description}</span>
    </div>
  );
}
