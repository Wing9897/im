import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import { RefreshCw, Settings2, Trash2 } from "lucide-react";
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
  autoSyncEnabled: boolean;
  busyAction: PublishedBusyAction;
  onSync: (row: CalendarSharePublishListItem) => void;
  onEdit: (worksetId: string) => void;
  onUnpublish: (row: CalendarSharePublishListItem) => void;
  t: TFunction;
};

/** Published-calendar card: cover + path + icon actions. */
export function SubscriptionsPublishedCard({
  row,
  handle,
  ownerAvatar,
  canMutate,
  autoSyncEnabled,
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
  const syncLabel = syncLoading ? t("published.syncing") : t("published.syncNow");
  const editLabel = t("published.edit");
  const unpublishLabel = unpublishLoading ? t("published.unpublishing") : t("published.unpublish");
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
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-xs">
          <Badge tone={visibilityBadgeTone(row.publicVisibility)}>{t(`visibility.${row.publicVisibility}`)}</Badge>
          {row.pendingSync && autoSyncEnabled && !row.lastError ? (
            <Badge tone="warning" data-testid={`subscriptions-published-pending-${row.worksetId}`}>
              {t("published.pendingSync")}
            </Badge>
          ) : null}
        </span>
      }
      actions={
        <div className="flex items-center gap-1">
          {row.worksetMissing ? null : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                loading={syncLoading}
                disabled={!canMutate || rowBusy}
                title={syncLabel}
                aria-label={syncLabel}
                onClick={() => void onSync(row)}
                data-testid={`subscriptions-published-sync-${row.worksetId}`}
              >
                {syncLoading ? null : <RefreshCw size={16} strokeWidth={2} aria-hidden />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onEdit(row.worksetId)}
                title={editLabel}
                aria-label={editLabel}
                data-testid={`subscriptions-published-edit-${row.worksetId}`}
              >
                <Settings2 size={16} strokeWidth={2} aria-hidden />
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="danger"
            size="icon"
            loading={unpublishLoading}
            disabled={!canMutate || rowBusy}
            title={unpublishLabel}
            aria-label={unpublishLabel}
            onClick={() => void onUnpublish(row)}
            data-testid={`subscriptions-unpublish-${row.worksetId}`}
          >
            {unpublishLoading ? null : <Trash2 size={16} strokeWidth={2} aria-hidden />}
          </Button>
        </div>
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
