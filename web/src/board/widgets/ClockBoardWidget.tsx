import { useEffect, useState } from "react";
import { getDateTimeLocale } from "../../i18n/locale";
import type { BoardWidgetProps } from "../types";

function formatNow(date: Date) {
  const locale = getDateTimeLocale();
  return {
    time: date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
    date: date.toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
    }),
  };
}

/** Local ops-center clock — no network. */
export function ClockBoardWidget({}: BoardWidgetProps) {
  const [now, setNow] = useState(() => formatNow(new Date()));

  useEffect(() => {
    const tick = () => setNow(formatNow(new Date()));
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="board-widget-body board-widget-clock" data-testid="board-clock-widget">
      <p className="board-clock__time" data-testid="board-clock-time">
        {now.time}
      </p>
      <p className="board-clock__date">{now.date}</p>
    </div>
  );
}
