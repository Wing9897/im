import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { SourceAddFormCard } from "../SourceAddFormCard";
import type { EmailFormFields, EmailProviderPreset } from "./emailFormModel";
import { EmailMailboxFields } from "./EmailMailboxFields";

interface EmailMailboxFormProps {
  form: EmailFormFields;
  setForm: Dispatch<SetStateAction<EmailFormFields>>;
  setPreset: (preset: EmailProviderPreset) => void;
  submitting: boolean;
  formError: string | null;
  onSubmit?: () => void;
  submitLabel?: string;
  variant?: "standalone" | "embedded";
}

export function EmailMailboxForm({
  form,
  setForm,
  setPreset,
  submitting,
  formError,
  onSubmit,
  submitLabel,
  variant = "standalone",
}: EmailMailboxFormProps) {
  const { t } = useTranslation("sources");
  const resolvedSubmit = submitLabel ?? t("email.addMailbox");
  const fields = (
    <EmailMailboxFields
      form={form}
      setForm={setForm}
      setPreset={setPreset}
      submitting={submitting}
    />
  );

  if (variant === "embedded") {
    const showAuthHint =
      formError != null &&
      /登入失敗|認證|App Password|帳號或密碼|credentials/i.test(formError);

    return (
      <>
        {fields}
        {formError && (
          <div className="mt-sm text-xs text-error">{formError}</div>
        )}
        {showAuthHint && (
          <div className="mt-sm text-xs leading-normal text-text-muted">
            {t("email.authHintPrefix")}
            <a
              href="https://support.google.com/accounts/answer/185833"
              target="_blank"
              rel="noreferrer"
            >
              {t("email.authHintLink")}
            </a>
            {t("email.authHintSuffix")}
          </div>
        )}
      </>
    );
  }

  return (
    <SourceAddFormCard
      formError={formError}
      submitting={submitting}
      submittingLabel={t("shared.processing")}
      submitLabel={resolvedSubmit}
      onSubmit={() => void (onSubmit?.() ?? Promise.resolve())}
    >
      <div className="mb-md text-xs leading-normal text-text-muted">
        {t("email.introPrefix")}
        <a
          href="https://support.google.com/accounts/answer/185833"
          target="_blank"
          rel="noreferrer"
        >
          {t("email.introLink")}
        </a>
        {t("email.introSuffix")}
      </div>
      {fields}
    </SourceAddFormCard>
  );
}
