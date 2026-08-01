import { useErrorToast } from "../../hooks/useErrorToast";
import { useSlashFocusSearch } from "../../hooks/useSlashFocusSearch";
import { useTranslation } from "react-i18next";
import { SettingsContentCard } from "../settings/SettingsShared";
import { LogEventsSection } from "./LogEventsSection";
import { LogFilterToolbar } from "./LogFilterToolbar";
import { LogSummaryCards } from "./LogSummaryCards";
import { LogPageProvider, useLogPageContext } from "./LogPageContext";

export function LogPage() {
  return (
    <LogPageProvider>
      <LogPageContent />
    </LogPageProvider>
  );
}

function LogPageContent() {
  const { t } = useTranslation("logs");
  const { logLoadError } = useLogPageContext();
  useSlashFocusSearch();
  useErrorToast(logLoadError, t("page.loadErrorPrefix"));

  return (
    <SettingsContentCard>
      <div className="flex flex-col gap-lg">
        <LogSummaryCards />

        <LogFilterToolbar />

        <LogEventsSection />
      </div>
    </SettingsContentCard>
  );
}
