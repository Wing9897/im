import { useTranslation } from "react-i18next";
import { isOvernightClockRange } from "../../domain/timeline/userEventKindSwitch";

type OvernightClockHintProps = {
  startClock: string;
  endClock: string;
  /** Stable test id for the call site (defaults to shared overnight hint). */
  testId?: string;
};

/**
 * Caption shown when end clock is earlier than start (e.g. 22:00 → 06:00).
 * Shared by calendar event fields, user-event dialog, and voice quiet hours.
 */
export function OvernightClockHint({
  startClock,
  endClock,
  testId = "overnight-clock-hint",
}: OvernightClockHintProps) {
  const { t } = useTranslation();
  if (!isOvernightClockRange(startClock, endClock)) return null;

  return (
    <p className="m-0 text-caption text-text-muted" data-testid={testId}>
      {t("overnightClockHint")}
    </p>
  );
}
