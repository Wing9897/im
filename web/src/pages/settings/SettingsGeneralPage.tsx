import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { saveSystemSettings } from "../../api/config";
import { restartCollector } from "../../api/system";
import { AnalysisDebugPanel } from "../../components/settings/AnalysisDebugPanel";
import { CollectorRestartPanel } from "../../components/settings/CollectorRestartPanel";
import { LanguageSwitcher } from "../../components/settings/LanguageSwitcher";
import { SystemVersionPanel } from "../../components/settings/SystemVersionPanel";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import { ToggleSwitch } from "../../components/ToggleSwitch";
import {
  Button,
  CollapsePanel,
  FormGrid,
  FormStack,
  SelectTile,
  SettingsRow,
  SurfaceCard,
  TextField,
} from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { useSimpleMode } from "../../context/SimpleModeContext";
import { toErrorMessage } from "../../utils/errors";
import { useSettingsPageState } from "../../components/settings/useSettingsPageState";
import { captionClass } from "../../components/ui/pageTypography";
import {
  resolveWeatherLocation,
  SYSTEM_WEATHER_LOCATION,
} from "../../hooks/monthWeather/timezone";
import { SettingsContentCard, SettingsFieldGroup } from "./SettingsShared";

const SYSTEM_LOCATION = SYSTEM_WEATHER_LOCATION;

function GeneralPrefCard({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <SurfaceCard
      material="panel"
      density="compact"
      role="region"
      aria-label={title}
      data-testid={testId}
    >
      {children}
    </SurfaceCard>
  );
}

export function SettingsGeneralPage() {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const { settings, applyPersistedSnapshot } = useSettingsPageState();
  const { showToast } = useToast();
  const { simpleMode, setSimpleMode } = useSimpleMode();
  const [weatherLocation, setWeatherLocation] = useState(SYSTEM_LOCATION);
  const [saving, setSaving] = useState(false);
  const [debugSaving, setDebugSaving] = useState(false);
  const [analysisTraceVerbose, setAnalysisTraceVerbose] = useState(false);
  const [restartingCollector, setRestartingCollector] = useState(false);
  const [showCollectorRestartConfirm, setShowCollectorRestartConfirm] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    setWeatherLocation(settings?.weatherLocation || SYSTEM_LOCATION);
  }, [settings?.weatherLocation]);

  useEffect(() => {
    setAnalysisTraceVerbose(Boolean(settings?.analysisTraceVerbose));
  }, [settings?.analysisTraceVerbose]);

  const followsSystem = weatherLocation === SYSTEM_LOCATION;
  const effectiveLocation = resolveWeatherLocation(weatherLocation);
  const saveWeatherLocation = async () => {
    const value = followsSystem ? SYSTEM_LOCATION : weatherLocation.trim();
    if (!value) {
      showToast(t("general.weatherLocationRequired"), "error");
      return;
    }
    setSaving(true);
    try {
      const snapshot = await saveSystemSettings({ weatherLocation: value });
      applyPersistedSnapshot(snapshot);
      showToast(t("general.weatherLocationSaved"), "success");
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmCollectorRestart = async () => {
    setRestartingCollector(true);
    try {
      const result = await restartCollector();
      showToast(result.message || t("general.collectorRestarted"), "success");
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    } finally {
      setRestartingCollector(false);
      setShowCollectorRestartConfirm(false);
    }
  };

  const persistDebugPatch = async (patch: { analysisTraceVerbose?: boolean }) => {
    setDebugSaving(true);
    const prevTrace = Boolean(settings?.analysisTraceVerbose);
    if (patch.analysisTraceVerbose !== undefined) {
      setAnalysisTraceVerbose(patch.analysisTraceVerbose);
    }
    try {
      const snapshot = await saveSystemSettings(patch);
      applyPersistedSnapshot(snapshot);
      showToast(t("general.debug.saved"), "success");
    } catch (error) {
      setAnalysisTraceVerbose(prevTrace);
      showToast(toErrorMessage(error), "error");
    } finally {
      setDebugSaving(false);
    }
  };

  const onTraceVerboseChange = (next: boolean) => {
    if (next === Boolean(settings?.analysisTraceVerbose)) return;
    void persistDebugPatch({ analysisTraceVerbose: next });
  };

  return (
    <SettingsContentCard>
      <SettingsFieldGroup>
        <FormGrid>
          <GeneralPrefCard title={tCommon("language.label")} testId="general-language-card">
            <LanguageSwitcher />
          </GeneralPrefCard>
          <GeneralPrefCard title={t("general.simpleModeLabel")} testId="general-simple-mode-card">
            <div className="min-w-0" title={t("general.simpleModeHelp")}>
              <SettingsRow
                layout="inline"
                label={t("general.simpleModeLabel")}
                help={t("general.simpleModeHint")}
              >
                <ToggleSwitch
                  checked={simpleMode}
                  onChange={setSimpleMode}
                  label={t("general.simpleModeLabel")}
                  showLabel={false}
                  data-testid="simple-mode-toggle"
                />
              </SettingsRow>
            </div>
          </GeneralPrefCard>
        </FormGrid>
        <GeneralPrefCard title={t("general.weatherLocationLabel")} testId="general-region-card">
          <FormStack gap="md">
            <SettingsRow
              layout="inline"
              label={t("general.weatherLocationLabel")}
              htmlFor="weather-location"
              help={t("general.weatherLocationHelp")}
            >
              <SelectTile
                compact
                variant="toggle"
                className="w-fit max-w-full shrink-0"
                active={followsSystem}
                aria-label={t("general.followSystem")}
                data-testid="weather-follow-system"
                onClick={() => {
                  setWeatherLocation(followsSystem ? "" : SYSTEM_LOCATION);
                }}
              >
                {t("general.followSystem")}
              </SelectTile>
            </SettingsRow>
            {!followsSystem ? (
              <TextField
                id="weather-location"
                className="w-48 max-w-full"
                value={weatherLocation}
                placeholder={t("general.weatherLocationPlaceholder")}
                onChange={(event) => setWeatherLocation(event.target.value)}
                aria-label={t("general.weatherLocationAria")}
              />
            ) : null}
            {effectiveLocation ? (
              <p
                className={`m-0 ${captionClass}`}
                data-testid="weather-location-current"
                aria-live="polite"
              >
                {t("general.weatherLocationCurrent", { location: effectiveLocation })}
              </p>
            ) : null}
            <div className="w-fit">
              <Button variant="secondary" size="sm" disabled={saving} onClick={() => void saveWeatherLocation()}>
                {saving ? t("shared.saving") : t("general.saveWeatherLocation")}
              </Button>
            </div>
          </FormStack>
        </GeneralPrefCard>
      </SettingsFieldGroup>

      <SettingsFieldGroup showDivider>
        <SystemVersionPanel />
      </SettingsFieldGroup>

      <SettingsFieldGroup showDivider>
        <CollapsePanel
          nested
          title={t("general.advancedSectionTitle")}
          open={advancedOpen}
          onToggle={() => setAdvancedOpen((value) => !value)}
        >
          <FormStack>
            <AnalysisDebugPanel
              analysisTraceVerbose={analysisTraceVerbose}
              busy={debugSaving}
              onAnalysisTraceVerboseChange={onTraceVerboseChange}
              embedded
            />
            <CollectorRestartPanel
              restarting={restartingCollector}
              onRequestConfirm={() => setShowCollectorRestartConfirm(true)}
              embedded
            />
          </FormStack>
        </CollapsePanel>
      </SettingsFieldGroup>

      {showCollectorRestartConfirm ? (
        <ConfirmDialog
          title={t("general.collectorRestartConfirmTitle")}
          accentColor="var(--warning)"
          body={<>{t("general.collectorRestartConfirmBody")}</>}
          confirmLabel={t("general.confirmRestart")}
          confirmBusyLabel={t("shared.restarting")}
          busy={restartingCollector}
          onCancel={() => setShowCollectorRestartConfirm(false)}
          onConfirm={confirmCollectorRestart}
        />
      ) : null}
    </SettingsContentCard>
  );
}
