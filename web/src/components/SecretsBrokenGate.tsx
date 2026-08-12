import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { rotateSecretsPublic } from "../api/system";
import { normalizeUsernameInput } from "./setup/useSetupDeviceAuth";
import { AlertBanner } from "./ui/AlertBanner";
import { Button } from "./ui/Button";
import { pageTitleClass } from "./ui/pageTypography";
import { PasswordField } from "./ui/PasswordField";
import { SettingsRow } from "./ui/SettingsRow";
import { TextField } from "./ui/TextField";

interface SecretsBrokenGateProps {
  onRecoverComplete: () => void;
  secretsError?: string | null;
}

export function SecretsBrokenGate({
  onRecoverComplete,
  secretsError,
}: SecretsBrokenGateProps) {
  const { t } = useTranslation("common");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await rotateSecretsPublic({
        username: normalizeUsernameInput(username),
        password,
      });
      onRecoverComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-base p-xl text-text-primary">
      <div
        className="im-material-panel w-full max-w-[480px] rounded-lg p-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={t("secretsBroken.dialogAria")}
        data-testid="secrets-broken-gate"
      >
        <h1 className={pageTitleClass}>{t("secretsBroken.title")}</h1>
        <p className="mt-md text-body leading-normal text-text-secondary">
          {t("secretsBroken.body")}
        </p>
        <AlertBanner variant="info" className="mt-lg !mb-0">
          <strong className="mb-1 block">{t("secretsBroken.infoTitle")}</strong>
          {t("secretsBroken.infoBody")}
        </AlertBanner>
        <p className="mt-lg text-body leading-normal text-text-secondary">
          {t("secretsBroken.fullResetHint")}
        </p>
        {(secretsError || error) && (
          <details className="mt-md text-body leading-normal text-text-secondary" open={Boolean(error)}>
            <summary className="cursor-pointer text-error">{t("secretsBroken.techDetails")}</summary>
            <pre className="mt-sm whitespace-pre-wrap break-words rounded-md bg-[color-mix(in_srgb,var(--error)_8%,transparent)] p-sm text-xs leading-normal text-error">
              {error || secretsError}
            </pre>
          </details>
        )}
        <form className="mt-xl flex flex-col gap-lg" onSubmit={(e) => void handleSubmit(e)}>
          <SettingsRow label={t("setup.username")} htmlFor="secrets-rotate-username">
            <TextField
              id="secrets-rotate-username"
              className="w-full"
              value={username}
              onChange={(e) => setUsername(normalizeUsernameInput(e.target.value))}
              placeholder={t("setup.usernamePlaceholder")}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              disabled={busy}
              required
              data-testid="secrets-rotate-username"
            />
          </SettingsRow>
          <SettingsRow label={t("setup.password")} htmlFor="secrets-rotate-password">
            <PasswordField
              id="secrets-rotate-password"
              className="w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={busy}
              required
              data-testid="secrets-rotate-password"
            />
          </SettingsRow>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={busy || !username.trim() || !password}
            data-testid="secrets-rotate-submit"
          >
            {busy ? t("secretsBroken.recovering") : t("secretsBroken.recover")}
          </Button>
        </form>
      </div>
    </div>
  );
}
