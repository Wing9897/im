import { useTranslation } from "react-i18next";
import { captionClass } from "../../../components/ui/pageTypography";

export function EventListEmpty({ filtered }: { filtered: boolean }) {
  const { t } = useTranslation("timeline");
  return (
    <p className={`${captionClass} m-0 shrink-0`}>
      {filtered ? t("eventList.emptyFiltered") : t("eventList.empty")}
    </p>
  );
}
