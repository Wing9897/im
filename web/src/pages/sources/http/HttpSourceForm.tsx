import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { SourceAddFormCard } from "../SourceAddFormCard";
import { HttpSourceFields } from "./HttpFormFields";
import type { HttpFormFields } from "./httpFormTypes";

interface HttpSourceFormProps {
  fields: HttpFormFields;
  setFields: Dispatch<SetStateAction<HttpFormFields>>;
  submitting: boolean;
  formError: string | null;
  onSubmit: () => void;
}

export function HttpSourceForm({
  fields,
  setFields,
  submitting,
  formError,
  onSubmit,
}: HttpSourceFormProps) {
  const { t } = useTranslation("sources");
  return (
    <SourceAddFormCard
      formError={formError}
      submitting={submitting}
      submittingLabel={t("http.adding")}
      submitLabel={t("http.addFetch")}
      submitDisabled={!fields.url.trim()}
      onSubmit={onSubmit}
    >
      <HttpSourceFields form={fields} setForm={setFields} submitting={submitting} idPrefix="http-add" />
    </SourceAddFormCard>
  );
}
