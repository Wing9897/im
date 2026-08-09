import { useTranslation } from "react-i18next";
import { SourceEditDialogShell } from "../board/SourceEditDialogShell";
import type { EmailMailboxInfo } from "../../../types";
import { EmailMailboxForm } from "./EmailMailboxForm";
import type { EmailFormFields, EmailProviderPreset } from "./emailFormModel";
import { applyEmailPreset } from "./emailFormModel";

interface EmailEditDialogProps {
  mailbox: EmailMailboxInfo;
  form: EmailFormFields;
  setForm: React.Dispatch<React.SetStateAction<EmailFormFields | null>>;
  resetCursors: boolean;
  setResetCursors: (value: boolean) => void;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
}

export function EmailEditDialog({
  mailbox,
  form,
  setForm,
  resetCursors,
  setResetCursors,
  submitting,
  error,
  onClose,
  onSave,
}: EmailEditDialogProps) {
  const { t } = useTranslation("sources");
  const setPreset = (preset: EmailProviderPreset) => {
    setForm((current: EmailFormFields | null) =>
      current ? applyEmailPreset(current, preset) : current,
    );
  };

  return (
    <SourceEditDialogShell
      title={t("email.editTitle", { name: mailbox.username })}
      submitting={submitting}
      onClose={onClose}
      onSave={onSave}
    >
      <EmailMailboxForm
        variant="embedded"
        form={form}
        setForm={(updater) =>
          setForm((current: EmailFormFields | null) => {
            if (!current) return current;
            return typeof updater === "function" ? updater(current) : updater;
          })
        }
        setPreset={setPreset}
        submitting={submitting}
        formError={error}
      />
      <div className="mt-3">
        <label className="mt-md flex items-center gap-sm text-body text-text-secondary">
          <input
            type="checkbox"
            checked={resetCursors}
            onChange={(e) => setResetCursors(e.target.checked)}
            disabled={submitting}
          />
          {t("email.resetCursors")}
        </label>
        {Object.keys(mailbox.folderCursors).length > 0 && (
          <div className="mt-xs text-xs text-text-muted">
            {t("email.currentCursors")}{" "}
            {Object.entries(mailbox.folderCursors)
              .map(([folder, uid]) => `${folder}=${uid}`)
              .join(", ")}
          </div>
        )}
      </div>
    </SourceEditDialogShell>
  );
}
