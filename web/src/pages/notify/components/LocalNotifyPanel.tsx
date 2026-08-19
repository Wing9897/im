import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SettingsContentCard } from "../../../components/settings/SettingsFormLayout";
import { NotifyChannelToggles } from "../../../components/notify/NotifyChannelToggles";
import { SwitchTrack, cardBodyClass, cardTitleClass } from "../../../components/ui";
import { useLocalNotifyPanelState } from "../hooks/useLocalNotifyPanelState";
import { LeadOffsetSection } from "./localNotify/LeadOffsetSection";
import { NotifySection } from "./localNotify/NotifySection";
import { PreambleSection } from "./localNotify/PreambleSection";
import { QuietHoursSection } from "./localNotify/QuietHoursSection";

/**
 * Local notifications for timed 情報事件、週期任務與手動／助手事件.
 * Full-page tab under `/notify?tab=notify`.
 * Agent STT/TTS lives on `/ai/voice` — not this page.
 */
export function LocalNotifyPanel() {
  const { t } = useTranslation("actions");
  const {
    settings,
    update,
    previewing,
    handlePreview,
  } = useLocalNotifyPanelState();

  return (
    <SettingsContentCard>
      <div className="flex min-w-0 flex-col gap-xs">
        <div className="flex flex-wrap items-center gap-md" data-testid="voice-header">
          <h2 className={`m-0 ${cardTitleClass}`}>{t("voice.title")}</h2>
          <label className="inline-flex cursor-pointer items-center gap-sm border-0 bg-transparent p-0 shadow-none outline-none ring-0">
            <span className="select-none text-caption text-text-secondary">
              {t("voice.enableLabel")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.enabled}
              aria-label={t("voice.enableLabel")}
              data-testid="notify-enabled"
              className="inline-flex appearance-none rounded-full border-0 bg-transparent p-0 shadow-none outline-none ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus-visible:ring-offset-1"
              onClick={() => update({ enabled: !settings.enabled })}
            >
              <SwitchTrack checked={settings.enabled} size="sm" />
            </button>
          </label>
          <Link
            to="/ai/voice"
            className="ml-auto shrink-0 text-caption text-accent underline-offset-2 hover:underline"
          >
            {t("voice.aiVoiceLink")}
          </Link>
        </div>
        <p className={`m-0 ${cardBodyClass}`}>{t("voice.caption")}</p>
      </div>

      <NotifySection title={t("voice.sectionChannels")} caption={t("voice.channelsCaption")}>
        <div data-testid="voice-channel-toggles">
          <NotifyChannelToggles variant="tiles" testIdPrefix="notify" />
        </div>
      </NotifySection>

      <LeadOffsetSection
        offsets={settings.leadOffsetsMinutes}
        onChange={(leadOffsetsMinutes) => update({ leadOffsetsMinutes })}
      />

      <QuietHoursSection
        quietHours={settings.quietHours}
        onChange={(quietHours) => update({ quietHours })}
      />

      <PreambleSection
        preambleChimeId={settings.preambleChimeId}
        previewing={previewing}
        onChange={(preambleChimeId) => update({ preambleChimeId })}
        onPreview={handlePreview}
      />
    </SettingsContentCard>
  );
}
