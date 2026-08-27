import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import { Lock } from "lucide-react";
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

type Props = {
  row: CalendarSharePublishListItem;
  handle: string;
  canMutate: boolean;
  busyId: string | null;
  onSync: (row: CalendarSharePublishListItem) => void;
  onEdit: (worksetId: string) => void;
  onUnpublish: (row: CalendarSharePublishListItem) => void;
  t: TFunction;
};

/** One published-calendar card plus sync / edit / unpublish actions. */
export function SubscriptionsPublishedCard({
  row,
  handle,
  canMutate,
  busyId,
  onSync,
  onEdit,
  onUnpublish,
  t,
}: Props) {
  const path = handle ? calendarShareKey(handle, row.slug) : row.slug;
  const name = row.worksetName.trim() || row.worksetId;
  const grants = grantsNote(row, t);
  return (
    <SubscriptionCalendarCard
      key={row.worksetId}
      title={path}
      emoji={row.emoji}
      description={row.description}
      icon={row.publicVisibility === "private_group" ? Lock : undefined}
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
                disabled={!canMutate || busyId === row.worksetId}
                onClick={() => void onSync(row)}
                data-testid={`subscriptions-published-sync-${row.worksetId}`}
              >
                {t("published.syncNow")}
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
            disabled={!canMutate || busyId === row.worksetId}
            onClick={() => void onUnpublish(row)}
            data-testid={`subscriptions-unpublish-${row.worksetId}`}
          >
            {t("published.unpublish")}
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
