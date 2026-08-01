import { useState } from "react";
import { useTranslation } from "react-i18next";
import { resolveBaseUrl } from "../api/baseUrl";
import { Button, FormStack } from "./ui";
import { formHelpClass } from "./ui/pageTypography";
import { isElectronDesktop } from "../electron/electronWindow";
import { detectAccessContext } from "../utils/accessContext";
import { SetupAuthFormFields } from "./setup/SetupAuthFormFields";
import { AuthSetupShell } from "./setup/AuthSetupShell";
import { useSetupDeviceAuth } from "./setup/useSetupDeviceAuth";

export type LoginWizardTone = "login" | "expired";

interface SessionReauthWizardProps {
  onComplete: () => void;
  /**
   * `expired` — local session just died (softer “sign in again” copy).
   * `login` — admin exists, no session (including all devices revoked).
   */
  tone?: LoginWizardTone;
  /** When false, show “all devices revoked” help instead of generic login help. */
  hasActiveDevice?: boolean;
  /**
   * From setup status: ``connection.json`` has ``resetPasswordForLocal: true``.
   * Required for the forgot-password control (server rejects otherwise).
   */
  allowLocalPasswordReset?: boolean;
}

/**
 * Unified password login for every bootstrapped, signed-out state
 * (session expired, needs_login, cold open with admin).
 */
export function SessionReauthWizard({
  onComplete,
  tone = "login",
  hasActiveDevice = true,
  allowLocalPasswordReset = false,
}: SessionReauthWizardProps) {
  const { t } = useTranslation("common");
  const auth = useSetupDeviceAuth(onComplete);
  const isDesktop = isElectronDesktop();
  const localAccess = detectAccessContext() === "local";
  const [useRemoteServer, setUseRemoteServer] = useState(
    () => isDesktop && !localAccess,
  );
  const [showForgot, setShowForgot] = useState(false);

  const showOtherServerToggle = isDesktop && localAccess;
  const canForgot = localAccess && !useRemoteServer && allowLocalPasswordReset;

  const title =
    showForgot && canForgot
      ? t("setup.titleForgot")
      : tone === "expired"
        ? t("reauth.title")
        : t("setup.titleLogin");
  const intro =
    showForgot && canForgot
      ? t("setup.introForgot")
      : tone === "expired"
        ? t("reauth.intro")
        : t("setup.introLogin");
  const loginHelp =
    hasActiveDevice || tone === "expired"
      ? t("setup.loginHelp")
      : t("setup.loginNoDevicesHelp");

  return (
    <AuthSetupShell
      testId="session-reauth-wizard"
      title={title}
      intro={intro}
      narrow
      restarting={auth.restarting}
      restartingLabel={t("setup.restartingShell")}
      error={auth.error}
      success={auth.success}
    >
      <FormStack gap="lg">
        {showForgot && canForgot ? (
          <>
            <p className={`mb-0 text-center ${formHelpClass}`}>{t("setup.forgotHelp")}</p>
            <SetupAuthFormFields
              idPrefix="reauth"
              auth={auth}
              fields={["username", "password", "confirmPassword"]}
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
                onClick={() => auth.onResetPassword({ remote: false })}
                data-testid="reauth-reset-password"
              >
                {auth.pending ? t("setup.working") : t("setup.resetPassword")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={auth.pending}
                onClick={() => {
                  setShowForgot(false);
                  auth.setSuccess(null);
                  auth.setError(null);
                }}
              >
                {t("setup.back")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className={`mb-0 text-center ${formHelpClass}`}>{loginHelp}</p>

            {!useRemoteServer ? (
              <p
                className={`mb-0 text-center ${formHelpClass}`}
                data-testid="reauth-local-hint"
              >
                {t("reauth.localHint", { origin: resolveBaseUrl() })}
              </p>
            ) : null}

            <SetupAuthFormFields
              idPrefix="reauth"
              auth={auth}
              fields={
                useRemoteServer
                  ? ["serverUrl", "username", "password", "deviceLabel"]
                  : ["username", "password", "deviceLabel"]
              }
              passwordAutoComplete="current-password"
            />

            <div className="flex flex-wrap items-center justify-center gap-sm">
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="min-w-[8.5rem]"
                disabled={auth.pending || !auth.username.trim() || !auth.password}
                onClick={() => auth.onLogin({ remote: useRemoteServer })}
                data-testid="reauth-login"
              >
                {auth.pending ? t("setup.working") : t("reauth.login")}
              </Button>
              {showOtherServerToggle ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={auth.pending}
                  onClick={() => {
                    setUseRemoteServer((v) => !v);
                    setShowForgot(false);
                    auth.setError(null);
                    auth.setSuccess(null);
                  }}
                  data-testid="reauth-toggle-remote"
                >
                  {useRemoteServer ? t("reauth.useThisHost") : t("reauth.useOtherServer")}
                </Button>
              ) : null}
              {canForgot ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={auth.pending}
                  onClick={() => {
                    setShowForgot(true);
                    auth.setError(null);
                    auth.setSuccess(null);
                  }}
                  data-testid="reauth-forgot-password"
                >
                  {t("setup.forgotPassword")}
                </Button>
              ) : null}
            </div>
            {localAccess && !useRemoteServer && !allowLocalPasswordReset ? (
              <p
                className={`mb-0 text-center ${formHelpClass}`}
                data-testid="reauth-forgot-arm-hint"
              >
                {t("setup.forgotArmHint")}
              </p>
            ) : null}
          </>
        )}
      </FormStack>
    </AuthSetupShell>
  );
}
