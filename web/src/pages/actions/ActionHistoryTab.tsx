import { PanelSection } from "../../components/ui";
import { useTranslation } from "react-i18next";
import { ActionTriggerHistorySection } from "./ActionTriggerHistorySection";

/** Notification trigger audit log — outbound actions + local voice reminders. */
export function ActionHistoryTab() {
  const { t } = useTranslation("actions");

  return (
    <PanelSection title={t("history.title")} showCount={false}>
      <p className="mb-md text-body text-text-secondary">{t("history.intro")}</p>
      <ActionTriggerHistorySection embedded />
    </PanelSection>
  );
}
