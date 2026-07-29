import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SetupStatus } from "../api/setup";
import { Button, FormStack } from "./ui";
import { SelectTile, SelectTileGrid } from "./ui/SelectTile";
import { formHelpClass, sectionTitleClass } from "./ui/pageTypography";
import type { ConnectionMode } from "../domain/connection/connectionStore";
import { ensureDesktopHostMode } from "../electron/electronConnection";
import { isElectronDesktop } from "../electron/electronWindow";
import { SetupAuthFormFields } from "./setup/SetupAuthFormFields";
import { AuthSetupShell } from "./setup/AuthSetupShell";
import { useSetupDeviceAuth } from "./setup/useSetupDeviceAuth";
import {
  SetupStepIndicator,
  type SetupIndicatorStepId,
  type SetupWizardStep,
} from "./setup/SetupStepIndicator";

interface FirstRunWizardProps {
  /** Present for gate wiring; create-system only runs when not bootstrapped. */
  status: SetupStatus;
  onComplete: () => void;
}

/**
 * Create-system flow only (no admin yet).
 * Desktop: choose host vs connect-to-remote, then register (host) or login (remote).
 * Pure Web: register against the page origin.
 */
export function FirstRunWizard({ status: _status, onComplete }: FirstRunWizardProps) {
  const { t } = useTranslation("common");
  const auth = useSetupDeviceAuth(onComplete);
  const isDesktop = isElectronDesktop();

  const [step, setStep] = useState<SetupWizardStep>(() =>
    isDesktop ? "choose" : "local",
  );
  const [mode, setMode] = useState<ConnectionMode | null>(() =>
    isDesktop ? null : "local",
  );

  const applyMode = (next: ConnectionMode) => {
    if (auth.pending) return;
    setMode(next);
    auth.setError(null);
    auth.setSuccess(null);
    setStep(next === "local" ? "local" : "remote");
    if (next !== "local") return;
    void auth.withBusy(async () => {
      if (await ensureDesktopHostMode()) {
        auth.markRestarting();
      }
      return false;
    });
  };

  const goBackToChoose = () => {
    if (!isDesktop) return;
    setStep("choose");
    auth.setError(null);
    auth.setSuccess(null);
  };

  const onStepSelect = (id: SetupIndicatorStepId) => {
    if (id === "choose") {
      goBackToChoose();
      return;
    }
    if (id === "connect") {
      setStep(mode === "remote" ? "remote" : "local");
      auth.setError(null);
      auth.setSuccess(null);
    }
  };

  const heading =
    step === "choose"
      ? { title: t("setup.title"), intro: t("setup.intro") }
      : mode === "remote"
        ? { title: t("setup.titleLogin"), intro: t("setup.introLogin") }
        : { title: t("setup.titleRegister"), intro: t("setup.introRegister") };

  return (
    <AuthSetupShell
      testId="first-run-wizard"
      title={heading.title}
      intro={heading.intro}
      restarting={auth.restarting}
      restartingLabel={t("setup.restartingShell")}
      error={auth.error}
      success={auth.success}
      headerExtra={
        isDesktop ? (
          <SetupStepIndicator
            step={step}
            onStepSelect={onStepSelect}
            navLabel={heading.title}
          />
        ) : null
      }
    >
      <div key={step} className="im-enter-rise">
        {step === "choose" && isDesktop ? (
          <FormStack gap="lg">
            <p className={`${sectionTitleClass} m-0 text-center`}>{t("setup.chooseMode")}</p>
            <SelectTileGrid columns="repeat(auto-fit, minmax(160px, 1fr))">
              <div data-testid="setup-mode-local">
                <SelectTile
                  active={mode === "local"}
                  onClick={() => applyMode("local")}
                  hint={t("setup.localHint")}
                  className="w-full"
                  disabled={auth.pending}
                >
                  {t("setup.local")}
                </SelectTile>
              </div>
              <div data-testid="setup-mode-remote">
                <SelectTile
                  active={mode === "remote"}
                  onClick={() => applyMode("remote")}
                  hint={t("setup.remoteHint")}
                  className="w-full"
                  disabled={auth.pending}
                >
                  {t("setup.remote")}
                </SelectTile>
              </div>
            </SelectTileGrid>
          </FormStack>
        ) : null}

        {step === "local" ? (
          <FormStack gap="lg">
            <p className={`mb-0 text-center ${formHelpClass}`}>{t("setup.registerHelp")}</p>
            <SetupAuthFormFields
              idPrefix="setup"
              auth={auth}
              fields={["username", "password", "confirmPassword", "deviceLabel"]}
              deviceLabelPlaceholder={t("setup.defaultHostLabel")}
              passwordAutoComplete="new-password"
            />
            <div className="flex flex-wrap items-center justify-center gap-sm">
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="min-w-[8.5rem]"
                disabled={
                  auth.pending ||
                  !auth.username.trim() ||
                  !auth.password ||
                  !auth.confirmPassword
                }
                onClick={() => auth.onRegister()}
                data-testid="setup-register"
              >
                {auth.pending ? t("setup.working") : t("setup.register")}
              </Button>
              {isDesktop ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={auth.pending}
                  onClick={goBackToChoose}
                >
                  {t("setup.back")}
                </Button>
              ) : null}
            </div>
          </FormStack>
        ) : null}

        {step === "remote" ? (
          <FormStack gap="lg">
            <p className={`mb-0 text-center ${formHelpClass}`}>{t("setup.remoteLoginHelp")}</p>
            <SetupAuthFormFields
              idPrefix="setup"
              auth={auth}
              fields={["serverUrl", "username", "password", "deviceLabel"]}
              passwordAutoComplete="current-password"
            />
            <div className="flex flex-wrap items-center justify-center gap-sm">
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="min-w-[8.5rem]"
                disabled={auth.pending || !auth.username.trim() || !auth.password}
                onClick={() => auth.onLogin({ remote: true })}
                data-testid="setup-login"
              >
                {auth.pending ? t("setup.working") : t("setup.login")}
              </Button>
              {isDesktop ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={auth.pending}
                  onClick={goBackToChoose}
                >
                  {t("setup.back")}
                </Button>
              ) : null}
            </div>
          </FormStack>
        ) : null}
      </div>
    </AuthSetupShell>
  );
}
