import { useTranslation } from "react-i18next";
import { AlertBanner, Button, FormActions, PasswordField, SettingsRow, TextField } from "../../../components/ui";
import { useFocusTrap } from "../../../hooks/useFocusTrap";
import { OverlayPortal } from "../../../components/common/OverlayPortal";
import { compactSourceDialogShellClass } from "../../../components/dialogs/dialogShellClasses";

interface VerificationDialogProps {
  step: "code_required" | "2fa_required";
  verifyCode: string;
  setVerifyCode: (value: string) => void;
  verifyPassword: string;
  setVerifyPassword: (value: string) => void;
  verifyError: string | null;
  verifySubmitting: boolean;
  onClose: () => void;
  onSubmitCode: () => Promise<void>;
  onSubmit2fa: () => Promise<void>;
}

export function VerificationDialog({
  step,
  verifyCode,
  setVerifyCode,
  verifyPassword,
  setVerifyPassword,
  verifyError,
  verifySubmitting,
  onClose,
  onSubmitCode,
  onSubmit2fa,
}: VerificationDialogProps) {
  const { t } = useTranslation("sources");
  const isCodeStep = step === "code_required";
  const inputValue = isCodeStep ? verifyCode : verifyPassword;
  const disabled = verifySubmitting || !inputValue;
  const focusTrapRef = useFocusTrap({ active: true, onEscape: onClose });

  return (
    <OverlayPortal onOverlayClick={onClose} lockBodyScroll>
      <div
        ref={focusTrapRef}
        className={`${compactSourceDialogShellClass} im-animate-in-scale`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-md text-base font-semibold text-text-primary">
          {isCodeStep ? t("verify.codeTitle") : t("verify.passwordTitle")}
        </h2>
        <p className="mb-md text-body text-text-secondary">
          {isCodeStep ? t("verify.codeHint") : t("verify.passwordHint")}
        </p>
        {verifyError ? (
          <AlertBanner variant="error" role="alert" className="mb-sm">
            {verifyError}
          </AlertBanner>
        ) : null}
        <SettingsRow
          label={isCodeStep ? t("verify.codeLabel") : t("verify.passwordLabel")}
          htmlFor="verify-input"
        >
          {isCodeStep ? (
            <TextField
              id="verify-input"
              type="text"
              placeholder={t("verify.codePlaceholder")}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              disabled={verifySubmitting}
              autoFocus
            />
          ) : (
            <PasswordField
              id="verify-input"
              placeholder={t("verify.passwordPlaceholder")}
              value={verifyPassword}
              onChange={(e) => setVerifyPassword(e.target.value)}
              disabled={verifySubmitting}
              autoFocus
            />
          )}
        </SettingsRow>
        <FormActions inline className="mt-md">
          <Button variant="secondary" onClick={onClose} disabled={verifySubmitting}>
            {t("shared.cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={disabled}
            onClick={() => void (isCodeStep ? onSubmitCode() : onSubmit2fa())}
          >
            {verifySubmitting ? t("verify.verifying") : t("verify.confirm")}
          </Button>
        </FormActions>
        {verifySubmitting ? (
          <p className="mt-sm text-center text-xs text-text-muted">
            {t("verify.connectingHint")}
          </p>
        ) : null}
      </div>
    </OverlayPortal>
  );
}
