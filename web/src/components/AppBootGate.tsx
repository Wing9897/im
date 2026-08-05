import { useTranslation } from "react-i18next";
import { SecretsBrokenGate } from "./SecretsBrokenGate";
import { FirstRunWizard } from "./FirstRunWizard";
import { SessionReauthWizard } from "./SessionReauthWizard";
import { useAppBoot } from "../hooks/useAppBoot";
import type { ReactNode } from "react";

function BootUnavailable({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="min-h-screen max-w-[480px] bg-surface-base p-6 text-text-primary">
      <h1 className="mt-0 text-xl">{t("boot.unavailableTitle")}</h1>
      <p className="leading-normal text-text-secondary">{message}</p>
      <p className="leading-normal text-text-secondary">
        {t("boot.unavailableHint", {
          script: "scripts/reset_local_databases.py --apply",
        })}
      </p>
      <button type="button" onClick={onRetry} className="mt-lg min-h-9">
        {t("boot.retry")}
      </button>
    </div>
  );
}

/** Renders boot phases; mounts `ready` children only after auth is ready. */
export function AppBootGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation("common");
  const { boot, checkBoot, markSecretsRecovered, onSetupComplete } = useAppBoot();

  if (boot.phase === "loading") {
    return (
      <div className="min-h-screen bg-surface-base p-6 text-text-primary">{t("boot.starting")}</div>
    );
  }
  if (boot.phase === "unavailable") {
    return (
      <BootUnavailable
        message={boot.error || t("boot.serviceUnavailable")}
        onRetry={() => {
          void checkBoot();
        }}
      />
    );
  }
  if (boot.phase === "secrets_blocked") {
    return (
      <SecretsBrokenGate
        onRecoverComplete={markSecretsRecovered}
        secretsError={boot.secretsError}
      />
    );
  }
  if (boot.phase === "setup" && boot.setupStatus) {
    return boot.setupStatus.bootstrapped ? (
      // Admin exists: one login card (expired vs cold login only changes copy).
      <SessionReauthWizard
        onComplete={onSetupComplete}
        tone={boot.setupReason === "session_expired" ? "expired" : "login"}
        hasActiveDevice={boot.setupStatus.hasActiveDevice}
        allowLocalPasswordReset={boot.setupStatus.resetPasswordForLocal}
      />
    ) : (
      // No admin yet: create-system (Desktop may still choose remote login).
      <FirstRunWizard status={boot.setupStatus} onComplete={onSetupComplete} />
    );
  }
  if (boot.phase === "ready") {
    return <>{children}</>;
  }
  // setup without status, or unexpected phase — never mount shell (avoids SSE 401 storms)
  return (
    <div className="min-h-screen bg-surface-base p-6 text-text-primary">{t("boot.starting")}</div>
  );
}
