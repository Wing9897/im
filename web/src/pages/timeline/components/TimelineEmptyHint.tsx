import { timelineEmptyHintClass } from "../timelineViewLayout";
import type { TimelineEmptyHint as TimelineEmptyHintModel } from "../timelineViewModel";

interface TimelineEmptyHintProps {
  hint: TimelineEmptyHintModel;
}

export function TimelineEmptyHint({ hint }: TimelineEmptyHintProps) {
  return (
    <div className={timelineEmptyHintClass} data-testid="timeline-empty-hint" role="status">
      <strong className="font-semibold text-text-primary">{hint.title}</strong>
      <span>{hint.description}</span>
    </div>
  );
}
