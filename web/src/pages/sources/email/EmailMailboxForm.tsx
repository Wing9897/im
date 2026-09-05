import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { errorMatchesCode } from "../../../i18n/errorCodes";
import { SourceAddFormCard } from "../board/SourceAddFormCard";
import type { EmailFormFields, EmailProviderPreset } from "./emailFormModel";
import { EmailMailboxFields } from "./EmailMailboxFields";

const IMAP_AUTH_ERROR_CODE = "imap_auth_failed";

interface EmailMailboxFormProps {
  form: EmailFormFields;
  setForm: Dispatch<SetStateAction<EmailFormFields>>;
  setPreset: (preset: EmailProviderPreset) => void;
  submitting: boolean;
  formError: string | null;
  formErrorCode?: string | null;
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
  formErrorCode,
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
      formErrorCode === IMAP_AUTH_ERROR_CODE ||
      (formError != null && errorMatchesCode(formError, IMAP_AUTH_ERROR_CODE));

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
