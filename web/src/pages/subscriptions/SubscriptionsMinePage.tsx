import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { removeCalendarShareSubscription } from "../../api/calendarShare";
import { SettingsContentCard, SettingsFieldGroup } from "../../components/settings/SettingsFormLayout";
import { AlertBanner, Button, DataList, EmptyStateLink, ListRow, ListRowMain } from "../../components/ui";
import { formHelpClass, sectionTitleClass } from "../../components/ui/pageTypography";
import { calendarShareKey } from "../../domain/calendarShare/subscribedCalendars";
import {
  invalidateCalendarShareCatalog,
  refreshCalendarShareCatalog,
  useCalendarShareCatalog,
} from "../../domain/calendarShare/useCalendarShareCatalog";
import { toErrorMessage } from "../../utils/errors";

/** Server-backed catalog of subscribed calendars (remove unsubscribes on IntelligenceCalendar). */
export function SubscriptionsMinePage() {
  const { t } = useTranslation("subscriptions");
  const catalog = useCalendarShareCatalog();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const onRemove = useCallback(async (handle: string, slug: string) => {
    const key = calendarShareKey(handle, slug);
    setBusyKey(key);
    try {
      await removeCalendarShareSubscription(handle, slug);
      invalidateCalendarShareCatalog();
      await refreshCalendarShareCatalog();
      setActionError(null);
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setBusyKey(null);
    }
  }, []);

  const connected = catalog.session?.connected === true;
  const items = catalog.items;
  const loadError = actionError ?? catalog.error;

  return (
    <SettingsContentCard>
      <SettingsFieldGroup>
        <h2 className={sectionTitleClass}>{t("mine.title")}</h2>
        <p className={`mb-0 ${formHelpClass}`}>{t("mine.help")}</p>
        {connected ? null : (
          <AlertBanner variant="warning" role="status" className="mb-0 max-w-[56ch]">
            {t("needLogin")}{" "}
            <Link to="/account/identity" className="font-medium text-accent no-underline hover:underline">
              {t("loginLink")}
            </Link>
          </AlertBanner>
        )}
        {loadError ? (
          <p className={`mb-0 ${formHelpClass} text-error`} role="alert">
            {loadError}
          </p>
        ) : null}
        {items.length === 0 ? (
          <div className="flex flex-col gap-sm" data-testid="subscriptions-mine-empty">
            <p className={`mb-0 ${formHelpClass}`}>{t("mine.empty")}</p>
            <EmptyStateLink to="/subscriptions/search">{t("mine.searchCta")}</EmptyStateLink>
          </div>
        ) : (
          <DataList maxHeightClass="max-h-[60vh]" data-testid="subscriptions-mine-list">
            {items.map((row) => {
              const key = calendarShareKey(row.handle, row.slug);
              return (
                <ListRow key={key}>
                  <ListRowMain>
                    <span className="font-medium">{key}</span>
                  </ListRowMain>
                  <Link
                    to="/timeline"
                    className="shrink-0 text-caption font-medium text-accent no-underline hover:underline"
                  >
                    {t("mine.openTimeline")}
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busyKey === key}
                    onClick={() => void onRemove(row.handle, row.slug)}
                    data-testid={`subscriptions-remove-${key}`}
                  >
                    {t("mine.remove")}
                  </Button>
                </ListRow>
              );
            })}
          </DataList>
        )}
      </SettingsFieldGroup>
    </SettingsContentCard>
  );
}
