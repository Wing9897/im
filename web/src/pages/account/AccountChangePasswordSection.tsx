import { useState } from "react";
import { useTranslation } from "react-i18next";
import { changePassword } from "../../api/setup";
import { Button, FormStack, SettingsRow, TextField } from "../../components/ui";
import { formHelpClass, sectionTitleClass } from "../../components/ui/pageTypography";
import { useToast } from "../../context/ToastContext";
import { toErrorMessage } from "../../utils/errors";

/** Account → Identity: change admin password (requires current password). */
export function AccountChangePasswordSection() {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!newPassword) {
      setError(t("setup.passwordInvalid"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("setup.passwordMismatch"));
      return;
    }
    setPending(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast(t("profile.password.changed"), "success");
    } catch (err) {
      const message = toErrorMessage(err);
      setError(message);
      showToast(message, "error");
    } finally {
      setPending(false);
    }
  };

  return (
    <section id="change-password" data-testid="profile-change-password">
      <FormStack gap="lg">
        <div>
          <h2 className={`${sectionTitleClass} m-0`}>{t("profile.password.title")}</h2>
          <p className={`mb-0 mt-xs max-w-[56ch] ${formHelpClass}`}>
            {t("profile.password.help")}
          </p>
        </div>

        <SettingsRow
          label={t("profile.password.current")}
          htmlFor="change-password-current"
        >
          <TextField
            id="change-password-current"
            type="password"
            autoComplete="current-password"
            className="max-w-[320px]"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            data-testid="change-password-current"
          />
        </SettingsRow>

        <SettingsRow label={t("profile.password.new")} htmlFor="change-password-new">
          <TextField
            id="change-password-new"
            type="password"
            autoComplete="new-password"
            className="max-w-[320px]"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            data-testid="change-password-new"
          />
        </SettingsRow>

        <SettingsRow
          label={t("profile.password.confirm")}
          htmlFor="change-password-confirm"
        >
          <TextField
            id="change-password-confirm"
            type="password"
            autoComplete="new-password"
            className="max-w-[320px]"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            data-testid="change-password-confirm"
          />
        </SettingsRow>

        {error ? (
          <p className={`mb-0 ${formHelpClass} text-error`} role="alert">
            {error}
          </p>
        ) : null}

        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={
              pending || !currentPassword || !newPassword || !confirmPassword
            }
            onClick={() => void onSubmit()}
            data-testid="change-password-submit"
          >
            {pending ? t("profile.password.saving") : t("profile.password.submit")}
          </Button>
        </div>
      </FormStack>
    </section>
  );
}
