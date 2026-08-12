import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { saveSystemSettings } from "../../api/config";
import { restartCollector } from "../../api/system";
import { AnalysisDebugPanel } from "../../components/settings/AnalysisDebugPanel";
import { CollectorRestartPanel } from "../../components/settings/CollectorRestartPanel";
import { LanguageSwitcher } from "../../components/settings/LanguageSwitcher";
import { SystemVersionPanel } from "../../components/settings/SystemVersionPanel";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import {
  Button,
  CheckboxField,
  CollapsePanel,
  FormStack,
  SettingsRow,
  TextField,
} from "../../components/ui";
import { formHelpClass } from "../../components/ui/pageTypography";
import { useToast } from "../../context/ToastContext";
import { useSimpleMode } from "../../context/SimpleModeContext";
import {
  getElectronConnection,
  setDesktopAllowLanAccess,
} from "../../electron/electronConnection";
import { toErrorMessage } from "../../utils/errors";
import { SettingsContentCard, SettingsFieldGroup, useSettingsPageState } from "./SettingsShared";

const SYSTEM_LOCATION = "system";

export function SettingsGeneralPage() {
  const { t } = useTranslation("settings");
  const { settings, applyPersistedSnapshot } = useSettingsPageState();
  const { showToast } = useToast();
  const { simpleMode, setSimpleMode } = useSimpleMode();
  const [weatherLocation, setWeatherLocation] = useState(SYSTEM_LOCATION);
  const [saving, setSaving] = useState(false);
  const [debugSaving, setDebugSaving] = useState(false);
  const [analysisTraceVerbose, setAnalysisTraceVerbose] = useState(false);
  const [restartingCollector, setRestartingCollector] = useState(false);
  const [showCollectorRestartConfirm, setShowCollectorRestartConfirm] = useState(false);
  const isDesktopHost = Boolean(getElectronConnection());
  const [allowLanAccess, setAllowLanAccess] = useState(false);
  const [lanBusy, setLanBusy] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    setWeatherLocation(settings?.weatherLocation || SYSTEM_LOCATION);
  }, [settings?.weatherLocation]);

  useEffect(() => {
    setAnalysisTraceVerbose(Boolean(settings?.analysisTraceVerbose));
  }, [settings?.analysisTraceVerbose]);

  useEffect(() => {
    const api = getElectronConnection();
    if (!api) return;
    void api.getConnection().then((cfg) => {
      setAllowLanAccess(Boolean(cfg.allowLanAccess) && cfg.mode === "host");
    });
  }, []);

  const onToggleLanAccess = async (next: boolean) => {
    setLanBusy(true);
    try {
      const restarted = await setDesktopAllowLanAccess(next);
      setAllowLanAccess(next);
      showToast(
        next ? t("general.lanAccessEnabled") : t("general.lanAccessDisabled"),
        "success",
      );
      if (restarted) {
        showToast(t("general.lanAccessRestarting"), "info");
      }
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    } finally {
      setLanBusy(false);
    }
  };

  const followsSystem = weatherLocation === SYSTEM_LOCATION;
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
        <LanguageSwitcher />
      </SettingsFieldGroup>

      <SettingsFieldGroup showDivider>
        <SettingsRow
          label={t("general.simpleModeLabel")}
          help={t("general.simpleModeHelp")}
        >
          <CheckboxField
            id="simple-mode-toggle"
            label={simpleMode ? t("shared.enabled") : t("shared.disabled")}
            checked={simpleMode}
            onChange={(e) => setSimpleMode(e.target.checked)}
            aria-label={t("general.simpleModeLabel")}
            data-testid="simple-mode-toggle"
          />
        </SettingsRow>
      </SettingsFieldGroup>

      {isDesktopHost ? (
        <SettingsFieldGroup showDivider>
          <SettingsRow
            label={t("general.lanAccessLabel")}
            help={t("general.lanAccessHelp")}
          >
            <CheckboxField
              id="allow-lan-access-toggle"
              label={allowLanAccess ? t("shared.enabled") : t("shared.disabled")}
              checked={allowLanAccess}
              disabled={lanBusy}
              onChange={(e) => void onToggleLanAccess(e.target.checked)}
              aria-label={t("general.lanAccessLabel")}
              data-testid="allow-lan-access-toggle"
            />
          </SettingsRow>
        </SettingsFieldGroup>
      ) : null}

      <SettingsFieldGroup showDivider>
        <FormStack>
          <SettingsRow
            label={t("general.weatherLocationLabel")}
            htmlFor="weather-location"
            help={t("general.weatherLocationHelp")}
          >
            <label className="inline-flex items-center gap-sm text-body text-text-primary">
              <input
                type="checkbox"
                checked={followsSystem}
                onChange={(event) => {
                  setWeatherLocation(event.target.checked ? SYSTEM_LOCATION : "");
                }}
              />
              {t("general.followSystem")}
            </label>
            {!followsSystem ? (
              <TextField
                id="weather-location"
                className="mt-sm max-w-[320px]"
                value={weatherLocation}
                placeholder={t("general.weatherLocationPlaceholder")}
                onChange={(event) => setWeatherLocation(event.target.value)}
                aria-label={t("general.weatherLocationAria")}
              />
            ) : (
              <p className={`${formHelpClass} mt-sm`}>{t("general.weatherLocationAutoHelp")}</p>
            )}
          </SettingsRow>
          <div>
            <Button variant="secondary" size="sm" disabled={saving} onClick={() => void saveWeatherLocation()}>
              {saving ? t("shared.saving") : t("general.saveWeatherLocation")}
            </Button>
          </div>
        </FormStack>
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
