import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { removeCalendarShareSubscription } from "../../api/calendarShare";
import { Button } from "../../components/ui";
import { formHelpClass } from "../../components/ui/pageTypography";
import {
  calendarShareKey,
  matchesCalendarShareFilter,
  subscribeCalendarIdentity,
  subscribePageStatus,
} from "../../domain/calendarShare/subscribedCalendars";
import {
  invalidateCalendarShareCatalog,
  useCalendarShareCatalog,
} from "../../domain/calendarShare/useCalendarShareCatalog";
import { toErrorMessage } from "../../utils/errors";
import { SubscriptionCalendarCard } from "./SubscriptionCalendarCard";
import {
  SubscriptionsCardSection,
  SubscriptionsListToolbar,
  SubscriptionsPageChrome,
} from "./SubscriptionsPageChrome";

/** Server-backed catalog of subscribed calendars (remove unsubscribes on IntelligenceCalendar). */
export function SubscriptionsMinePage() {
  const { t } = useTranslation("subscriptions");
  const catalog = useCalendarShareCatalog();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState("");

  const onRemove = useCallback(async (handle: string, slug: string) => {
    const key = calendarShareKey(handle, slug);
    setBusyKey(key);
    try {
      await removeCalendarShareSubscription(handle, slug);
      await invalidateCalendarShareCatalog();
      setActionError(null);
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setBusyKey(null);
    }
  }, []);

  const status = subscribePageStatus({
    loading: catalog.loading,
    connected: catalog.session?.connected,
    unreachable: catalog.unreachable,
  });
  const canMutate = status === "ok";
  const items = catalog.items;
  const visible = useMemo(
    () =>
      items.filter((row) =>
        matchesCalendarShareFilter(listFilter, row.handle, row.slug, calendarShareKey(row.handle, row.slug)),
      ),
    [items, listFilter],
  );
  const filtering = listFilter.trim().length > 0;
  const loadError = actionError ?? (status === "ok" ? catalog.error : null);

  return (
    <SubscriptionsPageChrome
      status={status}
      error={loadError}
      toolbar={
        <SubscriptionsListToolbar
          value={listFilter}
          onChange={setListFilter}
          testId="subscriptions-mine-filter"
        />
      }
    >
      <SubscriptionsCardSection
        status={status}
        hasItems={visible.length > 0}
        empty={
          <p className={`mb-0 ${formHelpClass}`}>
            {filtering ? t("listFilter.empty") : t("mine.empty")}
          </p>
        }
        emptyTestId={filtering ? "subscriptions-mine-filter-empty" : "subscriptions-mine-empty"}
        listTestId="subscriptions-mine-list"
      >
        {visible.map((row) => {
          const identity = subscribeCalendarIdentity(row);
          return (
            <SubscriptionCalendarCard
              key={identity.key}
              title={identity.label}
              emoji={identity.emoji}
              description={row.description}
              data-testid={`subscriptions-mine-card-${identity.key}`}
              actions={
                <>
                  <Link
                    to="/timeline"
                    className="inline-flex min-h-7 shrink-0 items-center text-caption font-medium text-accent no-underline hover:underline"
                  >
                    {t("mine.openTimeline")}
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!canMutate || busyKey === identity.key}
                    onClick={() => void onRemove(row.handle, row.slug)}
                    data-testid={`subscriptions-remove-${identity.key}`}
                  >
                    {t("mine.remove")}
                  </Button>
                </>
              }
            />
          );
        })}
      </SubscriptionsCardSection>
    </SubscriptionsPageChrome>
  );
}
