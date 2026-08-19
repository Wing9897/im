import { useTranslation } from "react-i18next";
import { OvernightClockHint } from "../../../../components/calendar/OvernightClockHint";
import { SelectTile, TextField } from "../../../../components/ui";
import type { NotifySettings } from "../../../../domain/notify/scanner/settings";
import { NotifySection } from "./NotifySection";

const compactTileClass = "w-fit max-w-max";

export function QuietHoursSection({
  quietHours,
  onChange,
}: {
  quietHours: NotifySettings["quietHours"];
  onChange: (quietHours: NotifySettings["quietHours"]) => void;
}) {
  const { t } = useTranslation("actions");
  return (
    <NotifySection title={t("voice.sectionQuiet")} caption={t("voice.quietCaption")}>
      <div className="flex min-w-0 flex-col gap-md">
        <div
          className="flex min-w-0 flex-wrap items-center gap-md"
          data-testid="voice-quiet-controls"
        >
          <SelectTile
            compact
            variant="toggle"
            className={compactTileClass}
            active={quietHours.enabled}
            data-testid="notify-quiet-hours-enabled"
            aria-label={t("voice.quietEnableLabel")}
            title={t("voice.quietEnableHelp")}
            onClick={() =>
              onChange({
                ...quietHours,
                enabled: !quietHours.enabled,
              })
            }
          >
            {t("voice.quietEnableLabel")}
          </SelectTile>
          <label className="flex w-fit items-center gap-sm text-caption text-text-secondary">
            <span className="shrink-0">{t("voice.quietStart")}</span>
            <TextField
              className="w-[9.5rem]"
              type="time"
              value={quietHours.start}
              aria-label={t("voice.quietStartAria")}
              disabled={!quietHours.enabled}
              onChange={(e) => onChange({ ...quietHours, start: e.target.value })}
            />
          </label>
          <label className="flex w-fit items-center gap-sm text-caption text-text-secondary">
            <span className="shrink-0">{t("voice.quietEnd")}</span>
            <TextField
              className="w-[9.5rem]"
              type="time"
              value={quietHours.end}
              aria-label={t("voice.quietEndAria")}
              disabled={!quietHours.enabled}
              onChange={(e) => onChange({ ...quietHours, end: e.target.value })}
            />
          </label>
        </div>
        <OvernightClockHint
          startClock={quietHours.start}
          endClock={quietHours.end}
          testId="voice-quiet-overnight-hint"
        />
      </div>
    </NotifySection>
  );
}
