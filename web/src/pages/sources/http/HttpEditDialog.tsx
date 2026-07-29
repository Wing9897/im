import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { HttpSourceInfo } from "../../../types";
import { SourceEditDialogShell } from "../SourceEditDialogShell";
import { HttpSourceFields } from "./HttpFormFields";
import type { HttpFormFields } from "./httpFormTypes";

interface HttpEditDialogProps {
  source: HttpSourceInfo;
  form: HttpFormFields;
  setForm: Dispatch<SetStateAction<HttpFormFields>>;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
}

export function HttpEditDialog({
  source,
  form,
  setForm,
  submitting,
  error,
  onClose,
  onSave,
}: HttpEditDialogProps) {
  const { t } = useTranslation("sources");
  return (
    <SourceEditDialogShell
      title={t("http.editTitle", { url: source.url })}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSave={onSave}
    >
      <HttpSourceFields
        form={form}
        setForm={setForm}
        submitting={submitting}
        isEdit
        idPrefix="http-edit"
      />
    </SourceEditDialogShell>
  );
}
