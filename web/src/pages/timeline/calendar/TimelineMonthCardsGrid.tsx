import { useTranslation } from "react-i18next";

import {
  monthCardKey,
  type MonthCardEmptyReason,
  type MonthCardModel,
} from "../../../domain/timeline/monthCardSources";
import type { TimelineItem } from "../../../types";
import { useBlockCardColors } from "../useBlockCardColors";
import { TimelineSplitMonthCard } from "./TimelineSplitMonthCard";
import { useSplitDayPopover } from "./useSplitDayPopover";

type TimelineMonthCardsGridProps = {
  cards: MonthCardModel[];
  omitted: number;
  emptyReason?: MonthCardEmptyReason | null;
  monthCursor: Date;
  monthDays: Date[];
  showDismissed?: boolean;
  onSelectEvent: (event: TimelineItem) => void;
  onFocusDay: (day: Date) => void;
  onCreateOnDay?: (day: Date) => void;
};

export function TimelineMonthCardsGrid({
  cards,
  omitted,
  emptyReason = "need_selection",
  monthCursor,
  monthDays,
  showDismissed = true,
  onSelectEvent,
  onFocusDay,
  onCreateOnDay,
}: TimelineMonthCardsGridProps) {
  const { t } = useTranslation("timeline");
  const { colors, setCardColor } = useBlockCardColors();
  const { open, selected, popoverRef, toggleDay, close } = useSplitDayPopover();

  if (cards.length === 0) {
    return (
      <div
        className="flex min-h-[12rem] flex-1 items-center justify-center px-lg py-xl text-center text-sm text-text-secondary"
        data-testid="timeline-month-cards-empty"
      >
        {t(
          emptyReason === "select_all"
            ? "calendar.monthCardsEmptySelectAll"
            : "calendar.monthCardsEmpty",
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-sm" data-testid="timeline-month-cards-grid">
      {omitted > 0 ? (
        <p className="px-1 text-xs text-text-muted" data-testid="timeline-month-cards-omitted">
          {t("calendar.monthCardsOmitted", { count: omitted })}
        </p>
      ) : null}
      <div className="im-split-month-cards">
        {cards.map((card) => {
          const key = monthCardKey(card);
          return (
            <TimelineSplitMonthCard
              key={key}
              title={card.title}
              kind={card.kind}
              events={card.events}
              monthCursor={monthCursor}
              monthDays={monthDays}
              showDismissed={showDismissed}
              accentColor={colors[key]}
              onAccentColorChange={(color) => setCardColor(key, color)}
              selectedDay={selected?.cardKey === key ? selected.day : null}
              openDay={open?.cardKey === key ? open.day : null}
              popoverRef={popoverRef}
              onToggleDay={(day) => toggleDay(key, day)}
              onSelectEvent={onSelectEvent}
              onFocusDay={onFocusDay}
              onCreateOnDay={onCreateOnDay}
              onClosePopover={close}
            />
          );
        })}
      </div>
    </div>
  );
}
