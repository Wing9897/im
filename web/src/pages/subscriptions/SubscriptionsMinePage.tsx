import { UserMinus } from "lucide-react";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { removeCalendarShareSubscription } from "../../api/calendarShare";
import { Button } from "../../components/ui";
import { formHelpClass } from "../../components/ui/pageTypography";
import {
  calendarShareKey,
  subscribeCalendarIdentity,
  subscribePageStatus,
} from "../../domain/calendarShare/subscribedCalendars";
import {
  applyCalendarShareCatalogItems,
  useCalendarShareCatalog,
} from "../../domain/calendarShare/useCalendarShareCatalog";
import { useSubscribeCatalogFilter } from "../../domain/calendarShare/useSubscribeCatalogFilter";
import { toErrorMessage } from "../../utils/errors";
import { SubscriptionCalendarCard } from "./SubscriptionCalendarCard";
import { useCatalogMembershipBusy } from "../../domain/calendarShare/useCatalogMembershipBusy";
import {
  SubscriptionsCardSection,
  SubscriptionsListToolbar,
  SubscriptionsPageChrome,
} from "./SubscriptionsPageChrome";

/** Server-backed catalog of subscribed calendars (remove unsubscribes on IntelligenceCalendar). */
export function SubscriptionsMinePage() {
  const { t } = useTranslation("subscriptions");
  const catalog = useCalendarShareCatalog();
  const { busyKey, runMembership } = useCatalogMembershipBusy();
  const [actionError, setActionError] = useState<string | null>(null);

  const onRemove = useCallback(async (handle: string, slug: string) => {
    const key = calendarShareKey(handle, slug);
    await runMembership(key, async () => {
      try {
        const payload = await removeCalendarShareSubscription(handle, slug);
        applyCalendarShareCatalogItems(payload.items ?? [], payload.ownHandle);
        setActionError(null);
      } catch (error) {
        setActionError(toErrorMessage(error));
      }
    });
  }, [runMembership]);

  const status = subscribePageStatus({
    loading: catalog.loading,
    connected: catalog.session?.connected,
    unreachable: catalog.unreachable,
  });
  const canMutate = status === "ok";
  const items = catalog.items;
  const { listFilter, setListFilter, visible, filtering } = useSubscribeCatalogFilter(items, (row) => [
    row.handle,
    row.slug,
    calendarShareKey(row.handle, row.slug),
  ]);
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
          status={status}
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
          const isRemoving = busyKey === identity.key;
          return (
            <SubscriptionCalendarCard
              key={identity.key}
              title={identity.label}
              ownerLabel={identity.handle}
              ownerAvatar={identity.ownerAvatar}
              cover={row.cover ?? identity.cover}
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
                    loading={isRemoving}
                    disabled={!canMutate || busyKey !== null}
                    onClick={() => void onRemove(row.handle, row.slug)}
                    data-testid={`subscriptions-remove-${identity.key}`}
                  >
                    {!isRemoving ? <UserMinus size={16} strokeWidth={2.5} aria-hidden="true" /> : null}
                    <span>{isRemoving ? t("mine.removing") : t("mine.remove")}</span>
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
