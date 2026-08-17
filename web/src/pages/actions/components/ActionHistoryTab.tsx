import { PanelSection, captionClass } from "../../../components/ui";
import { useTranslation } from "react-i18next";
import { ActionTriggerHistorySection } from "./ActionTriggerHistorySection";

/** Notification trigger audit log — outbound actions + local notifications. */
export function ActionHistoryTab() {
  const { t } = useTranslation("actions");

  return (
    <PanelSection title={t("history.title")} showCount={false}>
      <p className={`mb-md m-0 ${captionClass}`}>{t("history.intro")}</p>
      <ActionTriggerHistorySection embedded />
    </PanelSection>
  );
}
