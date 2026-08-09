import { useTranslation } from "react-i18next";
import { SourceAddFormCard } from "../board/SourceAddFormCard";
import type { RssAddFormProps } from "./providers/types";
import { RssFeedFields } from "./RssFeedFields";

export function RssFeedForm({
  fields,
  setFields,
  submitting,
  formError,
  onSubmit,
}: RssAddFormProps) {
  const { t } = useTranslation("sources");
  return (
    <SourceAddFormCard
      formError={formError}
      submitting={submitting}
      submittingLabel={t("rssFields.adding")}
      submitLabel={t("rssFields.addFeed")}
      submitDisabled={!fields.feedUrl.trim()}
      onSubmit={onSubmit}
    >
      <RssFeedFields
        form={fields}
        setForm={setFields}
        submitting={submitting}
        idPrefix="rss"
        pollClassName="max-w-[200px]"
      />
    </SourceAddFormCard>
  );
}
