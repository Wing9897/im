import { Volume2, VolumeX, Zap, ZapOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FilterChip, SegmentedControl, SelectTile, SelectTileGrid } from "../ui";
import { useNotifyChannelSettings } from "../../hooks/useNotifyChannelSettings";
import type { NotifyFlashMode } from "../../domain/notify/scanner/settings";

type NotifyChannelTogglesProps = {
  variant: "icons" | "labeled" | "tiles";
  testIdPrefix: string;
};

/**
 * Independent 語音 / 畫面 shortcuts. Same prefs store as the notifications page.
 */
export function NotifyChannelToggles({
  variant,
  testIdPrefix,
}: NotifyChannelTogglesProps) {
  const { t } = useTranslation("common");
  const { t: tActions } = useTranslation("actions");
  const {
    voiceEnabled,
    flashEnabled,
    flashMode,
    setVoiceEnabled,
    setFlashEnabled,
    setFlashMode,
  } = useNotifyChannelSettings();

  const voiceLabel = t("notify.channelVoice");
  const flashLabel = t("notify.channelFlash");
  const iconSize = 17;
  const iconBtnClass = "im-icon-btn";

  const flashModeControl = (
    <div
      className="flex flex-wrap items-center gap-sm"
      data-testid={`${testIdPrefix}-flash-mode`}
    >
      <span className="text-caption text-text-secondary">{tActions("voice.flashModeLabel")}</span>
      <SegmentedControl
        layout="inline"
        ariaLabel={tActions("voice.flashModeAria")}
        items={[
          { id: "timed", label: tActions("voice.flashModeTimed") },
          { id: "persistent", label: tActions("voice.flashModePersistent") },
        ]}
        value={flashMode}
        onChange={(id) => setFlashMode(id as NotifyFlashMode)}
      />
    </div>
  );

  if (variant === "tiles") {
    return (
      <div className="flex min-w-0 flex-col gap-md">
        <SelectTileGrid columns="repeat(auto-fit, minmax(140px, 1fr))" className="gap-md">
          <SelectTile
            compact
            variant="toggle"
            active={voiceEnabled}
            data-testid={`${testIdPrefix}-channel-voice`}
            aria-label={t("notify.channelVoiceAria")}
            onClick={() => setVoiceEnabled(!voiceEnabled)}
          >
            {voiceLabel}
          </SelectTile>
          <SelectTile
            compact
            variant="toggle"
            active={flashEnabled}
            data-testid={`${testIdPrefix}-channel-flash`}
            aria-label={t("notify.channelFlashAria")}
            onClick={() => setFlashEnabled(!flashEnabled)}
          >
            {flashLabel}
          </SelectTile>
        </SelectTileGrid>
        {flashModeControl}
        <p className="m-0 text-caption text-text-muted">{tActions("voice.flashModeCaption")}</p>
      </div>
    );
  }

  if (variant === "labeled") {
    return (
      <div className="flex shrink-0 items-center gap-xs" data-testid={`${testIdPrefix}-channel-toggles`}>
        <FilterChip
          size="sm"
          active={voiceEnabled}
          data-testid={`${testIdPrefix}-channel-voice`}
          aria-label={t("notify.channelVoiceAria")}
          title={voiceLabel}
          onClick={() => setVoiceEnabled(!voiceEnabled)}
        >
          {voiceEnabled ? <Volume2 size={14} aria-hidden="true" /> : <VolumeX size={14} aria-hidden="true" />}
          {voiceLabel}
        </FilterChip>
        <FilterChip
          size="sm"
          active={flashEnabled}
          data-testid={`${testIdPrefix}-channel-flash`}
          aria-label={t("notify.channelFlashAria")}
          title={flashLabel}
          onClick={() => setFlashEnabled(!flashEnabled)}
        >
          {flashEnabled ? <Zap size={14} aria-hidden="true" /> : <ZapOff size={14} aria-hidden="true" />}
          {flashLabel}
        </FilterChip>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-xs" data-testid={`${testIdPrefix}-channel-toggles`}>
      <button
        type="button"
        className={`${iconBtnClass}${voiceEnabled ? "" : " opacity-50"}`}
        aria-label={t("notify.channelVoiceAria")}
        aria-pressed={voiceEnabled}
        title={voiceLabel}
        data-testid={`${testIdPrefix}-channel-voice`}
        onClick={() => setVoiceEnabled(!voiceEnabled)}
      >
        {voiceEnabled ? (
          <Volume2 size={iconSize} strokeWidth={2} aria-hidden="true" />
        ) : (
          <VolumeX size={iconSize} strokeWidth={2} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        className={`${iconBtnClass}${flashEnabled ? "" : " opacity-50"}`}
        aria-label={t("notify.channelFlashAria")}
        aria-pressed={flashEnabled}
        title={flashLabel}
        data-testid={`${testIdPrefix}-channel-flash`}
        onClick={() => setFlashEnabled(!flashEnabled)}
      >
        {flashEnabled ? (
          <Zap size={iconSize} strokeWidth={2} aria-hidden="true" />
        ) : (
          <ZapOff size={iconSize} strokeWidth={2} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
