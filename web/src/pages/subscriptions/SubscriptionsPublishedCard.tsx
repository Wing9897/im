import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import { Badge, Button } from "../../components/ui";
import { captionClass } from "../../components/ui/pageTypography";
import type { CalendarSharePublishListItem } from "../../api/calendarShare";
import { calendarShareKey } from "../../domain/calendarShare/subscribedCalendars";
import { isPublicListing } from "../../domain/calendarShare/listingVisibility";
import { toErrorMessage } from "../../utils/errors";
import {
  SubscriptionCalendarCard,
  visibilityAccentClass,
  visibilityBadgeTone,
} from "./SubscriptionCalendarCard";

type PublishedBusyAction = { worksetId: string; action: "sync" | "unpublish" } | null;

type Props = {
  row: CalendarSharePublishListItem;
  handle: string;
  ownerAvatar: string;
  canMutate: boolean;
  busyAction: PublishedBusyAction;
  onSync: (row: CalendarSharePublishListItem) => void;
  onEdit: (worksetId: string) => void;
  onUnpublish: (row: CalendarSharePublishListItem) => void;
  t: TFunction;
};

/** One published-calendar card plus sync / edit / unpublish actions. */
export function SubscriptionsPublishedCard({
  row,
  handle,
  ownerAvatar,
  canMutate,
  busyAction,
  onSync,
  onEdit,
  onUnpublish,
  t,
}: Props) {
  const path = handle ? calendarShareKey(handle, row.slug) : row.slug;
  const name = row.worksetName.trim() || row.worksetId;
  const grants = grantsNote(row, t);
  const rowBusy = busyAction?.worksetId === row.worksetId;
  const syncLoading = rowBusy && busyAction?.action === "sync";
  const unpublishLoading = rowBusy && busyAction?.action === "unpublish";
  return (
    <SubscriptionCalendarCard
      key={row.worksetId}
      title={path}
      ownerLabel={handle}
      ownerAvatar={ownerAvatar}
      cover={row.cover}
      description={row.description}
      accentClass={visibilityAccentClass(row.publicVisibility)}
      data-testid={`subscriptions-published-${row.worksetId}`}
      badge={
        <Badge tone={visibilityBadgeTone(row.publicVisibility)}>{t(`visibility.${row.publicVisibility}`)}</Badge>
      }
      actions={
        <>
          {row.worksetMissing ? null : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={syncLoading}
                disabled={!canMutate || rowBusy}
                onClick={() => void onSync(row)}
                data-testid={`subscriptions-published-sync-${row.worksetId}`}
              >
                {syncLoading ? t("published.syncing") : t("published.syncNow")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEdit(row.worksetId)}
                data-testid={`subscriptions-published-edit-${row.worksetId}`}
              >
                {t("published.edit")}
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={unpublishLoading}
            disabled={!canMutate || rowBusy}
            onClick={() => void onUnpublish(row)}
            data-testid={`subscriptions-unpublish-${row.worksetId}`}
          >
            {unpublishLoading ? t("published.unpublishing") : t("published.unpublish")}
          </Button>
        </>
      }
    >
      {row.worksetMissing ? (
        <span data-testid={`subscriptions-published-missing-${row.worksetId}`}>
          {t("published.missingWorkset")}
        </span>
      ) : (
        <span>{name}</span>
      )}
      {grants ? <p className={`mb-0 mt-xs ${captionClass}`}>{grants}</p> : null}
      {row.lastError ? (
        <p
          className={`mb-0 mt-xs ${captionClass}`}
          data-testid={`subscriptions-published-error-${row.worksetId}`}
        >
          {toErrorMessage(row.lastError)}
        </p>
      ) : row.pendingSync ? (
        <p
          className={`mb-0 mt-xs ${captionClass}`}
          data-testid={`subscriptions-published-pending-${row.worksetId}`}
        >
          {t("published.pendingSync")}
        </p>
      ) : null}
    </SubscriptionCalendarCard>
  );
}

function grantsNote(
  row: CalendarSharePublishListItem,
  t: TFunction,
): ReactNode {
  const count = row.grants?.length ?? 0;
  if (isPublicListing(row.publicVisibility)) {
    return count > 0 ? t("published.grantsSummary", { count }) : null;
  }
  return count > 0 ? t("published.grantsClosed", { count }) : t("published.grantsEmpty");
}
